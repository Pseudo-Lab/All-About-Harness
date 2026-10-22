import { defineTool } from '@deepseek-ai/dsh-tools';
import { runRalph } from './core.mjs';
import { snapshotTests, runAcceptance } from './host.mjs';

export const name = 'custom-ralph';
export const inject = ['tools', 'subagents'];

/** Mount the custom loop. Configuration belongs to the preset, never model arguments. */
export function createRuntime(ctx, config) {
  const { workspace, frozenRoots, testFiles, provider = 'spawn', maxRounds = 5 } = config;
  if (!workspace || !frozenRoots?.length || !testFiles?.length) throw new Error('workspace, frozenRoots, testFiles required');
  if (!Number.isInteger(maxRounds) || maxRounds < 1 || maxRounds > 8) throw new Error('maxRounds must be 1..8');
  const controllers = new Set();
  const childRoles = new Map();
  const roleTools = {
    implementation: new Set(['read', 'write', 'edit', 'structured_output']),
    test: new Set(['read', 'bash', 'structured_output']),
  };
  const startupTools = new Set(['read', 'structured_output']);
  // toolFilter only filters global definitions. The final guard also checks
  // scoped tools inherited from the standing preset, including delegation.
  ctx.effect(() => ctx.tools.guard(execution => {
    const agent = execution.agent;
    if (!agent) return undefined;
    const role = childRoles.get(agent.id);
    const depth = Math.max(agent.options?.subagentDepth ?? 0, agent.session?.header.delegationDepth ?? 0);
    if (role === undefined && depth === 0) return undefined;
    const allowed = role === undefined ? startupTools : roleTools[role];
    return allowed.has(execution.name) ? undefined
      : `Custom RALPH ${role ?? 'unassigned descendant'} cannot execute ${execution.name}`;
  }));
  let busy = false;
  ctx.on('dispose', async () => {
    const pending = [...controllers];
    for (const item of pending) item.controller.abort(new Error('Plugin disposed'));
    await Promise.allSettled(pending.map(item => item.done));
  });
  return {
    async withRun(task, exec, executeLoop) {
      if (!exec.agent) throw new Error('Calling agent required');
      if (busy) throw new Error('RALPH workspace already in use');
      const backend = ctx.subagents.getProvider(provider);
      if (!backend || backend.inheritsParentContext || !backend.capabilities.outputSchema || !backend.capabilities.toolFilter) throw new Error('Fresh structured spawn provider required');
      busy = true;
      const controller = new AbortController();
      const abort = () => controller.abort(exec.signal.reason);
      exec.signal.addEventListener('abort', abort, { once: true });
      if (exec.signal.aborted) abort();
      let finish;
      const item = { controller, done: new Promise(resolve => { finish = resolve; }) };
      controllers.add(item);
      try {
        return await executeLoop({ task, maxRounds, signal: controller.signal,
          record: config.record ?? (async () => {}),
          snapshotTests: () => snapshotTests(workspace, frozenRoots),
          runAcceptance: ({ signal }) => runAcceptance({ workspace, testFiles, signal, timeoutMs: config.timeoutMs }),
          startChild: async ({ role, round, task, feedback, signal }) => {
            const run = await ctx.subagents.start(provider, {
              parent: exec.agent, signal, label: `RALPH ${round} ${role}`, maxDepth: 1,
              // Visibility filter for globals; the final guard enforces scoped tools.
              toolFilter: { allow: role === 'implementation' ? ['read', 'write', 'edit'] : ['read', 'bash'] },
              outputSchema: { type: 'object', additionalProperties: false,
                properties: { status: { type: 'string', enum: role === 'implementation' ? ['ready', 'blocked'] : ['pass', 'fail', 'blocked'] }, summary: { type: 'string' } }, required: ['status', 'summary'] },
              prompt: [{ type: 'text', text: JSON.stringify({ role, round, task, feedback, workspace,
                frozenRoots, environment: { TODO_CLI: `${workspace}/cli.mjs` }, command: [process.execPath, '--test', '--test-reporter=tap', ...testFiles],
                instructions: role === 'implementation'
                  ? (config.implementationInstruction ?? 'Implement only the current round stage in shared workspace. Never change frozen roots, run shell commands, or delegate. Tests are handled by the separate test role. Return ready after the current stage, or blocked for an actual environment blocker.')
                  : 'Independently inspect implementation and execute the exact command once in workspace. Never edit files or delegate. Return pass only if tests ran and passed; assertion failures return fail, environment errors return blocked. Include actual test counts and exit code in the summary. When finished, call the structured_output tool with exactly {status, summary}; a plain text final answer is not a valid test result. Do not repeat manual checks after a clear suite result.' }) }],
            });
            // Install policy before returning the handle to the orchestrator.
            // Startup remains fail-closed through the depth-based guard above.
            childRoles.set(run.id, role);
            return {
              id: run.id, localAgent: run.localAgent, result: run.result,
              async dispose() {
                try { await run.dispose(); }
                finally { childRoles.delete(run.id); }
              },
            };
          },
        });
      } finally {
        exec.signal.removeEventListener('abort', abort);
        controllers.delete(item);
        finish();
        busy = false;
      }
    },
  };
}

/** Compatibility file-based entry; Creator executes the same core inside its VM. */
export function apply(ctx, config) {
  const runtime = createRuntime(ctx, config);
  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'custom_ralph',
    description: 'Implement and independently verify with fresh children, up to five rounds.',
    parameters: { task: { type: 'string', required: true } },
    isConcurrencySafe: () => false,
    output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    execute({ task }, exec) { return runtime.withRun(task, exec, runRalph); },
  })));
}
