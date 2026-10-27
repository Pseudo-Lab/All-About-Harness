// Model-free probe: boot a host composition shaped like dsh-base's shell stack,
// mount one preset from ./config for an agent, list its tools, call them directly.
// node --import ./config/harness-resolve.mjs probe.mjs <presetId> [tool '<json args>']...
import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import Group from '@deepseek-ai/cordis-plugin-group'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import AgentPresets from '@deepseek-ai/dsh-agent-presets'
import SubprocessLocal from '@deepseek-ai/dsh-subprocess-local'
import SandboxLocal from '@deepseek-ai/dsh-sandbox-local'
import SandboxPolicy from '@deepseek-ai/dsh-sandbox-policy'
import BashSandbox from '@deepseek-ai/dsh-bash-sandbox'
import FsSandbox from '@deepseek-ai/dsh-fs-sandbox'

const here = dirname(fileURLToPath(import.meta.url))
const lab = process.env.WEEK3_LAB ?? join(homedir(), 'week3-lab')
const [presetId = 'stage1', ...calls] = process.argv.slice(2)
await mkdir(lab, { recursive: true })

const harness = process.env.DSH_HARNESS ?? join(here, '../../../deepseek-harness')

const ctx = new Context()
// Bare package names in a preset resolve from the host composition's base, as in the
// real app where the host is the dsh-base bundle (agent-presets/src/mount.ts:80-104).
ctx.baseUrl = pathToFileURL(join(harness, 'packages/bundle/base')).href + '/'
await ctx.plugin(Loader)
ctx.loader.builtins.include = Include
ctx.loader.builtins.group = Group
await ctx.plugin(LlmRuntime)
await ctx.plugin(SessionStore)
await ctx.plugin(SessionProjectionRegistry)
await ctx.plugin(SystemPrompt, { personaPrefix: '' })
await ctx.plugin(ToolRuntime)
await ctx.plugin(AgentRegistry)
await ctx.plugin(AgentLoop, { agents: [] })
// Host shell stack, as in packages/bundle/base/cordis.patch.yml (timeoutMs 30000 marks the host shell).
await ctx.plugin(SubprocessLocal)
await ctx.plugin(SandboxLocal)
await ctx.plugin(SandboxPolicy, { mode: 'workspace-write', workspaceRoot: lab })
await ctx.plugin(BashSandbox, { timeoutMs: 30000 })
await ctx.plugin(FsSandbox, { cwd: lab }) // host ctx.fs, as in base (cordis.patch.yml:479)
await ctx.plugin(AgentPresets, { default: presetId, roots: [{ path: join(here, 'config'), trust: 'user' }], includeShippedRoot: false, includeUserRoot: false })
await new Promise(r => setTimeout(r, 200)) // let the host services settle before mounting

console.log(`# preset=${presetId} lab=${lab}`)
let agent
try {
  const handle = await ctx.agents.create({
    sessionId: SessionId(`probe-${Date.now()}`),
    meta: { cwd: lab },
    setup: async agentCtx => void await ctx.agentPresets.mount(agentCtx, presetId),
  })
  agent = handle.agent
} catch (error) {
  console.log('MOUNT FAILED:', error.message)
  process.exit(0)
}
console.log('tools (agent):', ctx.tools.schemas(agent).map(s => s.name).sort())
console.log('tools (no agent):', ctx.tools.schemas().map(s => s.name).sort())

for (let i = 0; i < calls.length; i += 2) {
  const name = calls[i]
  const args = JSON.parse(calls[i + 1] ?? '{}')
  const result = await ctx.tools.execute({ callId: `call-${i}`, name, arguments: args, agent, signal: AbortSignal.timeout(90_000) })
  console.log(`\n## ${name} ${JSON.stringify(args)}`)
  console.log(JSON.stringify(result, null, 2).slice(0, 4000))
}
await ctx.registry.dispose?.()
process.exit(0)
