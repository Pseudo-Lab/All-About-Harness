import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink, rename, chmod, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { snapshotTests, runAcceptance } from '../plugin/host.mjs';

async function fixture(t) {
  const workspace = await mkdtemp(join(tmpdir(), 'ralph-host-'));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  await mkdir(join(workspace, 'frozen'));
  const file = join(workspace, 'frozen', 'tiny.test.mjs');
  return { workspace, file, hash: () => snapshotTests(workspace, ['frozen']),
    execute: () => runAcceptance({ workspace, testFiles: ['frozen/tiny.test.mjs'], timeoutMs: 3000, signal: new AbortController().signal }) };
}
for (const [label, source, kind] of [
  ['passing', "import test from 'node:test'; test('one', () => {});", 'passed'],
  ['assertion', "import test from 'node:test'; import assert from 'node:assert/strict'; test('one', () => assert.equal(1, 2));", 'assertion-failure'],
  ['throw', "throw new Error('module initialization failed');", 'infrastructure-error'],
  ['zero tests', '// intentionally no tests', 'infrastructure-error'],
]) test(`real runner classifies ${label}`, async t => {
  const f = await fixture(t); await writeFile(f.file, source);
  const result = await f.execute(); assert.equal(result.kind, kind, result.summary);
  if (kind === 'passed') { assert.equal(result.exitCode, 0); assert.ok(result.testsRun > 0); }
  if (kind === 'assertion-failure') { assert.notEqual(result.exitCode, 0); assert.ok(result.testsRun > 0); assert.match(result.summary, /ERR_ASSERTION/); }
});

test('runner executes TODO_CLI from run workspace, not bundled example', async t => {
  const f = await fixture(t);
  await writeFile(join(f.workspace, 'cli.mjs'), 'console.log("workspace cli");');
  await writeFile(f.file, `import test from 'node:test'; import assert from 'node:assert/strict'; import {resolve} from 'node:path'; test('workspace binding', () => assert.equal(process.env.TODO_CLI, resolve('cli.mjs')));`);
  const result = await f.execute(); assert.equal(result.kind, 'passed', result.summary);
});

test('runner cancellation propagates instead of producing pass', async t => {
  const f = await fixture(t); await writeFile(f.file, "import test from 'node:test'; test('wait', async () => { await new Promise(r => setTimeout(r, 20000)); });");
  const controller = new AbortController();
  const running = runAcceptance({ workspace: f.workspace, testFiles: ['frozen/tiny.test.mjs'], signal: controller.signal, timeoutMs: 3000 });
  setTimeout(() => controller.abort(new Error('cancel requested')), 50);
  await assert.rejects(running, /cancel requested/);
});

test('runner timeout blocks as infrastructure error', async t => {
  const f = await fixture(t); await writeFile(f.file, 'setInterval(() => {}, 1000);');
  const result = await runAcceptance({ workspace: f.workspace, testFiles: ['frozen/tiny.test.mjs'], timeoutMs: 50 });
  assert.equal(result.kind, 'infrastructure-error'); assert.notEqual(result.exitCode, 0);
});

test('snapshot stable unchanged, detects bytes, membership, rename and permissions', async t => {
  const f = await fixture(t); await writeFile(f.file, 'one'); const original = await f.hash();
  assert.equal(await f.hash(), original);
  await writeFile(f.file, 'two'); assert.notEqual(await f.hash(), original);
  await writeFile(f.file, 'one'); assert.equal(await f.hash(), original);
  const extra = join(f.workspace, 'frozen', 'extra'); await writeFile(extra, ''); assert.notEqual(await f.hash(), original);
  await rm(extra); assert.equal(await f.hash(), original);
  await rename(f.file, extra); assert.notEqual(await f.hash(), original);
  await rename(extra, f.file); await chmod(f.file, 0o700); assert.notEqual(await f.hash(), original);
});

test('snapshot refuses file and ancestor symlinks, missing roots, and outside roots', async t => {
  const f = await fixture(t); await writeFile(f.file, 'fixed');
  await symlink(f.file, join(f.workspace, 'frozen', 'linked'));
  await assert.rejects(f.hash(), /symlink/i);
  await rm(join(f.workspace, 'frozen', 'linked'));
  await symlink(join(f.workspace, 'frozen'), join(f.workspace, 'alias'));
  await assert.rejects(snapshotTests(f.workspace, ['alias/tiny.test.mjs']), /symlink/i);
  await assert.rejects(snapshotTests(f.workspace, ['missing']));
  await assert.rejects(snapshotTests(f.workspace, ['../outside']), /inside workspace/);
  await assert.rejects(snapshotTests(f.workspace, []), /required/i);
});
