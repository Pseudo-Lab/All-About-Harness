import { readFile, appendFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const name = 'experiment-bootstrap';
export const inject = ['agents', 'sessions', 'tools', 'subagents', 'agentPresets', 'agentDefaultModel'];

export function apply(ctx, config) {
  const controller = new AbortController();
  ctx.on('dispose', () => controller.abort(new Error('Experiment disposed')));
  let liveSeq = 0;
  const liveTypes = new Set(['run/start', 'run/end', 'run/error', 'round/start', 'round/end',
    'child/start', 'child/end', 'acceptance/start', 'acceptance/end']);
  const record = async (event) => {
    const at = new Date().toISOString();
    await appendFile(config.events, JSON.stringify({ at, ...event }) + '\n');
    if (!config.liveEvents || !liveTypes.has(event.event)) return;
    const live = { seq: ++liveSeq, at, event: event.event };
    for (const key of ['round', 'role', 'childId', 'status', 'kind', 'exitCode', 'testsRun']) {
      if (event[key] !== undefined) live[key] = event[key];
    }
    if (event.event === 'round/start') live.handoff = String(event.handoff ?? '').slice(0, 4000);
    if (event.event === 'child/end') live.summary = String(event.summary ?? '').slice(0, 4000);
    if (event.event === 'acceptance/end') {
      const summary = String(event.summary ?? '');
      live.passed = Number(summary.match(/^# pass (\d+)\s*$/m)?.[1] ?? 0);
      live.failed = Number(summary.match(/^# fail (\d+)\s*$/m)?.[1] ?? 0);
      live.summary = summary.slice(-6000);
    }
    if (event.event === 'round/end') live.result = event.test?.status === 'pass' && event.acceptance?.exitCode === 0 ? 'pass' : 'continue';
    await appendFile(config.liveEvents, JSON.stringify(live) + '\n');
  };
  if (config.mode === 'official') ctx.provide('experimentLoop', {
    run(objective, exec) {
      return dispatch(exec.agent, 'ralph', { objective, maxRounds: config.runtimeConfig.maxRounds }, exec.signal);
    },
  });
  async function dispatch(agent, tool, args, signal = controller.signal) {
    await record({ event: 'tool/start', tool, arguments: args });
    const result = await ctx.agents.withInitiator(agent, () => ctx.tools.execute({
      callId: `experiment-${randomUUID()}`, name: tool, arguments: args, agent, signal,
    }));
    await record({ event: 'tool/end', tool, result });
    if (result.isError) throw new Error(`Tool ${tool} failed; see bootstrap.jsonl`);
    return result.value;
  }
  async function run() {
    await ctx.get('loader').await();
    if (config.mode === 'custom') {
      const { createRuntime } = await import(pathToFileURL(config.runtimeModule).href);
      // Host supplies single-child startup, IO, and cleanup; no rounds run here.
      ctx.provide('ralphHost', createRuntime(ctx, { ...config.runtimeConfig, record }));
    }
    const selection = ctx.agentDefaultModel.currentSelection();
    if (selection.provider !== 'amazon-bedrock' || selection.model !== config.expectedModel) {
      throw new Error('Unexpected Bedrock model route');
    }
    const { agent } = await ctx.agents.create({
      sessionId: `experiment-${randomUUID()}`,
      meta: { cwd: process.cwd(), agentPreset: config.presetId },
      agentOptions: { provider: selection.provider, model: selection.model },
      setup: async (agentCtx) => { await ctx.agentPresets.mount(agentCtx, config.presetId); },
    });
    await agent.whenIdle();
    if (config.mode === 'custom' && ctx.tools.get('custom_ralph', agent)) {
      throw new Error('Creator experiment must not mount the file-based loop tool');
    }
    await record({ event: 'agent/created', sessionId: agent.id, preset: config.presetId, selection, mode: config.mode });
    const definition = await dispatch(agent, 'cordis_define', {
      plugin: { kind: 'new', idPrefix: 'loop' },
      name: config.mode === 'custom' ? 'Creator-native Coding RALPH' : 'Official comparison entry',
      purpose: config.mode === 'custom' ? 'Control rounds, structured handoff and termination inside the Creator dynamic package.' : 'Execute official Ralph under the same task conditions.',
      code: { host: await readFile(config.creatorCode, 'utf8') },
    });
    const activation = await dispatch(agent, 'cordis_run', {
      pluginId: definition.pluginId, packageId: definition.packageId, mode: 'run',
    });
    if (activation.status !== 'running') throw new Error('Creator host plugin did not activate synchronously');
    // A check exercises real mounting and define/run, but never invokes either loop.
    if (!config.check) await record({ event: 'run/start' });
    const value = config.check ? { status: 'checked-no-model', activation } :
      await dispatch(agent, 'creator_run_loop', { objective: await readFile(config.task, 'utf8') });
    if (!config.check) await record({ event: 'run/end', status: config.mode === 'custom' ? value.status : value.result?.status });
    await ctx.sessions.flush(agent.session);
    await writeFile(config.result, JSON.stringify({ mode: config.mode, sessionId: agent.id, preset: config.presetId, value }, null, 2) + '\n');
    await record({ event: 'experiment/end', status: config.check ? 'checked-no-model' : 'executed' });
    ctx.get('appExit')(0);
  }
  void run().catch(async (error) => {
    // Provider error messages may contain transport details; retain tool evidence privately.
    await record({ event: 'run/error', status: 'blocked' });
    await record({ event: 'experiment/error', message: 'Bootstrap failed; inspect private stderr and tool events.' });
    await writeFile(config.result + '.error.txt', String(error?.stack ?? error), { mode: 0o600 });
    ctx.get('appExit')(1);
  });
}
