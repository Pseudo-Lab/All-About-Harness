import { readFile, appendFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const name = 'experiment-bootstrap';
export const inject = ['agents', 'sessions', 'tools', 'subagents', 'agentPresets', 'agentDefaultModel'];

export function apply(ctx, config) {
  const controller = new AbortController();
  ctx.on('dispose', () => controller.abort(new Error('Experiment disposed')));
  const record = async (event) => appendFile(config.events, JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n');
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
    if (selection.provider !== 'amazon-bedrock' || selection.model !== 'us.anthropic.claude-sonnet-4-5-20250929-v1:0') {
      throw new Error('Expected the exact week1 Sonnet 4.5 route');
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
    const value = config.check ? { status: 'checked-no-model', activation } :
      await dispatch(agent, 'creator_run_loop', { objective: await readFile(config.task, 'utf8') });
    await ctx.sessions.flush(agent.session);
    await writeFile(config.result, JSON.stringify({ mode: config.mode, sessionId: agent.id, preset: config.presetId, value }, null, 2) + '\n');
    await record({ event: 'experiment/end', status: config.check ? 'checked-no-model' : 'executed' });
    ctx.get('appExit')(0);
  }
  void run().catch(async (error) => {
    // Provider error messages may contain transport details; retain tool evidence privately.
    await record({ event: 'experiment/error', message: 'Bootstrap failed; inspect private stderr and tool events.' });
    await writeFile(config.result + '.error.txt', String(error?.stack ?? error), { mode: 0o600 });
    ctx.get('appExit')(1);
  });
}
