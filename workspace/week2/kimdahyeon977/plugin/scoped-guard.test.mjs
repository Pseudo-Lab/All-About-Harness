import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const harness = resolve(here, '../../../../deepseek-harness');
const require = createRequire(resolve(harness, 'packages/core/tools/package.json'));
const load = name => import(pathToFileURL(require.resolve(name)).href);
const { Context } = await load('@deepseek-ai/cordis');
const { default: SystemPrompt } = await load('@deepseek-ai/dsh-system-prompt');
const { default: Tools } = await load('@deepseek-ai/dsh-tools');
const { createScope, bindScopeParent } = await load('@deepseek-ai/dsh-scope');
const source = (await readFile(resolve(here, 'index.mjs'), 'utf8'))
  .replace("'@deepseek-ai/dsh-tools'", JSON.stringify(pathToFileURL(require.resolve('@deepseek-ai/dsh-tools')).href))
  .replace(/'\.\/(.+?\.mjs)'/g, (_, file) => JSON.stringify(pathToFileURL(resolve(here, file)).href));
const plugin = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

async function fixture(t) {
  const workspace = await mkdtemp(resolve(tmpdir(), 'ralph-scoped-'));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  await mkdir(resolve(workspace, 'frozen'));
  await writeFile(resolve(workspace, 'frozen/check.test.mjs'), "import test from 'node:test'; test('fixed acceptance',()=>{});\n");
  const ctx = new Context();
  await ctx.plugin(SystemPrompt, {});
  await ctx.plugin(Tools);
  t.after(() => ctx.fiber.dispose());
  async function scoped(id, depth, parent) {
    const agent = { id, options: { subagentDepth: depth }, session: { header: { delegationDepth: depth, cwd: workspace } } };
    let scope;
    await ctx.plugin(Object.assign(inner => { scope = createScope(inner, agent); }, { inject: ['tools', 'systemPrompt'] }));
    if (parent) bindScopeParent(agent, parent);
    agent.ctx = scope.ctx;
    return agent;
  }
  const preset = await scoped('standing-preset', 0);
  const parent = await scoped('parent', 0, preset);
  const hits = [];
  for (const name of ['read', 'write', 'edit', 'bash', 'structured_output', 'subagent', 'subagent_fork', 'workflow', 'ralph', 'cordis_run']) {
    preset.ctx.tools.register({ name, description: name, parameters: { type: 'object', properties: {} },
      output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: value }] },
      execute: async () => { hits.push(name); return `ran:${name}`; } });
  }
  const backend = { inheritsParentContext: false, capabilities: { outputSchema: true, toolFilter: true } };
  const subagents = { getProvider: () => backend, start: async () => { throw new Error('stub start required'); } };
  const view = new Proxy(preset.ctx, { get(target, key) { return key === 'subagents' ? subagents : Reflect.get(target, key); } });
  plugin.apply(view, { workspace, frozenRoots: ['frozen'], testFiles: ['frozen/check.test.mjs'] });
  const execute = (agent, name, args = {}) => ctx.tools.execute({ agent, name, arguments: args, signal: new AbortController().signal, callId: `test-${Math.random()}` });
  return { ctx, preset, parent, hits, scoped, subagents, execute };
}

test('preset-scoped delegation cannot execute in an unassigned child or deeper descendant', async t => {
  const f = await fixture(t);
  const child = await f.scoped('starting-child', 1, f.preset);
  const grandchild = await f.scoped('grandchild', 2, child);
  assert.ok(f.ctx.tools.get('subagent', child), 'preset-scoped delegation is visible to the child');
  // A later extensible allow cannot bypass the final guard.
  f.preset.ctx.on('tools/pre-execute', async () => ({ kind: 'allow' }), { prepend: true });
  for (const agent of [child, grandchild]) {
    for (const name of ['subagent', 'subagent_fork', 'workflow', 'ralph', 'custom_ralph', 'cordis_run', 'run_code', 'bash', 'write']) {
      assert.equal((await f.execute(agent, name)).isError, true, `${agent.id}: ${name} must be denied`);
    }
  }
  assert.deepEqual(f.hits, []);
  assert.notEqual((await f.execute(f.parent, 'subagent')).isError, true);
});

test('real scoped tool dispatch enforces each live role and removes role on disposal', async t => {
  const f = await fixture(t);
  const children = [];
  let count = 0;
  f.subagents.start = async (_provider, request) => {
    const role = request.label.endsWith('implementation') ? 'implementation' : 'test';
    const child = await f.scoped(`child-${++count}`, 1, f.preset);
    children.push(child);
    assert.ok(f.ctx.tools.get('subagent', child));
    // Exercise the startup interval before the adapter receives the handle.
    assert.equal((await f.execute(child, 'subagent')).isError, true);
    const result = new Promise((resolveResult, reject) => setImmediate(async () => {
      try {
        const allowed = role === 'implementation' ? ['read', 'write', 'edit', 'structured_output'] : ['read', 'bash', 'structured_output'];
        for (const name of allowed) assert.notEqual((await f.execute(child, name)).isError, true, `${role} must allow ${name}`);
        for (const name of ['subagent', 'subagent_fork', 'workflow', 'ralph', 'custom_ralph', 'cordis_run', 'run_code', ...(role === 'implementation' ? ['bash'] : ['write', 'edit'])]) {
          assert.equal((await f.execute(child, name)).isError, true, `${role} must deny ${name}`);
        }
        resolveResult({ stopReason: 'completed', structured: { status: role === 'implementation' ? 'ready' : 'pass', summary: 'scoped policy exercised' } });
      } catch (error) { reject(error); }
    }));
    return { id: child.id, localAgent: child, result, dispose: async () => {} };
  };
  const result = await f.execute(f.parent, 'custom_ralph', { task: 'exercise role restrictions' });
  assert.notEqual(result.isError, true, JSON.stringify(result));
  assert.equal(result.value.status, 'complete', JSON.stringify(result));
  assert.equal(children.length, 2);
  for (const child of children) {
    assert.equal((await f.execute(child, 'write')).isError, true, 'disposed role must no longer allow writes');
    assert.equal((await f.execute(child, 'bash')).isError, true, 'disposed role must no longer allow shell');
  }
});
