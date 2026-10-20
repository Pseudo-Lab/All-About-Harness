import { readFile, appendFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

export const name = 'experiment-bootstrap';
export const inject = ['agents', 'sessions', 'tools', 'agentPresets', 'agentDefaultModel'];

export function apply(ctx, config) {
  const controller = new AbortController();
  ctx.on('dispose', () => controller.abort(new Error('Experiment disposed')));
  const record = async (event) => appendFile(config.events, JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n');
  ctx.provide('experimentLoop', {
    async run(objective, exec) {
      const target = config.mode === 'custom' ? 'custom_ralph' : 'ralph';
      return dispatch(exec.agent, target, config.mode === 'custom' ? { task: objective } : { objective, maxRounds: 5 }, exec.signal);
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
    await record({ event: 'agent/created', sessionId: agent.id, preset: config.presetId, selection, mode: config.mode });
    const definition = await dispatch(agent, 'cordis_define', {
      plugin: { kind: 'new', idPrefix: 'loop' }, name: 'Coding experiment bridge',
      purpose: 'Activate and invoke the bounded coding controller through Creator Mode.',
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
