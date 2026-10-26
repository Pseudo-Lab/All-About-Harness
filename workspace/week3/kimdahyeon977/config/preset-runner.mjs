// Replaces headless-runner for these runs: the shipped runner composes no preset
// roster (packages/bundle/headless/src/index.ts:180-191), so this one mounts the
// chosen preset into the agent before handing it the task.
import { randomUUID } from 'node:crypto'
import { installModelSelection } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'

export const name = 'week3-preset-runner'
export const inject = ['agents', 'sessions', 'tools', 'agentPresets', 'agentDefaultModel']

export function apply(ctx, config) {
  async function run() {
    await ctx.get('loader').await()
    const selection = ctx.agentDefaultModel.currentSelection()
    const { agent } = await ctx.agents.create({
      sessionId: `week3-${randomUUID()}`,
      meta: { cwd: process.cwd(), agentPreset: config.presetId },
      agentOptions: { provider: selection.provider, model: selection.model },
      setup: async agentCtx => {
        installModelSelection(agentCtx, { current: selection, assembled: undefined })
        await ctx.agentPresets.mount(agentCtx, config.presetId)
      },
    })
    await agent.whenIdle()
    console.log(`[preset-runner] preset=${config.presetId} tools=${JSON.stringify(ctx.tools.schemas(agent).map(s => s.name).sort())}`)
    agent.followup(createUserMessage({ content: [{ type: 'text', text: config.task }], source: { kind: 'user' } }))
    await agent.whenIdle()
    await ctx.sessions.flush(agent.session)
    ctx.get('appExit')(0)
  }
  void run().catch(error => {
    console.error(`[preset-runner] ${error?.stack ?? error}`)
    ctx.get('appExit')(1)
  })
}
