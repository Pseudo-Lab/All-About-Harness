// One headless agent run over a preset from ./config, on Bedrock Haiku.
// node agent-run.mjs <presetId> <task...>
// Credentials: BEDROCK_ENV file (default ~/.dsh/bedrock.env); only the three AWS values are passed on.
import { spawn, execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createWriteStream, existsSync, readdirSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

const here = dirname(fileURLToPath(import.meta.url))
const harness = process.env.DSH_HARNESS ?? join(here, '../../../deepseek-harness')
const lab = process.env.WEEK3_LAB ?? join(homedir(), 'week3-lab')
const [presetId, ...words] = process.argv.slice(2)
if (!presetId || words.length === 0) throw new Error('Usage: node agent-run.mjs <presetId> <task...>')

const run = await mkdtemp(join(tmpdir(), `week3-${presetId}-`))
const home = join(run, 'dsh-home')
await mkdir(home)
await mkdir(lab, { recursive: true })
const overlay = join(run, 'presets.patch.json')
const task = words.join(' ')
// Host bash/fs tools off so the model can only act through the preset's tools.
await writeFile(overlay, JSON.stringify([
  ...['headless-runner', 'tool-bash', 'tool-fs', 'tool-fs-search'].map(id => ({ id, disabled: true })),
  { insert: [
    { id: 'week3-presets', name: '@deepseek-ai/dsh-agent-presets', config: {
      default: presetId, includeUserRoot: false, includeShippedRoot: false, roots: [{ path: join(here, 'config'), trust: 'user' }] } },
    { id: 'week3-preset-runner', name: join(here, 'config/preset-runner.mjs'), config: { presetId, task } },
  ] },
], null, 2))

const values = parseEnv(await readFile(process.env.BEDROCK_ENV ?? join(homedir(), '.dsh/bedrock.env'), 'utf8'))
const env = { ...process.env, DSH_HOME: home, DSH_TOOLS_MODE: 'native', DSH_TELEMETRY_DISABLED: '1', DSH_TELEMETRY_MODE: 'DISABLED',
  AWS_ACCESS_KEY_ID: values.BEDROCK_ACCESS_KEY, AWS_SECRET_ACCESS_KEY: values.BEDROCK_SECRET_KEY,
  AWS_REGION: values.BEDROCK_REGION, AWS_DEFAULT_REGION: values.BEDROCK_REGION,
  // Plugins import @deepseek-ai/* by name; resolve them from the local checkout.
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import ${join(here, 'config/harness-resolve.mjs')}`.trim() }

const out = createWriteStream(join(run, 'stdout.log'), { mode: 0o600 })
const err = createWriteStream(join(run, 'stderr.log'), { mode: 0o600 })
// The CLI still requires the task argument even with headless-runner off.
const child = spawn(process.execPath, [join(harness, 'apps/cli/lib/bin.js'), '--profile', 'headless',
  '--patch', join(here, 'config/bedrock-haiku.patch.yml'), '--patch', overlay, task], { cwd: lab, env, stdio: ['ignore', 'pipe', 'pipe'] })
child.stdout.pipe(out); child.stderr.pipe(err)
child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr)
const code = await new Promise((done, reject) => { child.on('error', reject); child.on('close', done) })
console.log(`\n# run=${run} exit=${code}`)

// Evidence: decode the session log (multi-frame zstd; Node's zstd stream stops at
// the first frame, so use the zstd CLI) and keep only the facts the README needs.
const sessions = join(home, 'sessions')
const file = existsSync(sessions) && readdirSync(sessions, { recursive: true }).map(String).find(p => p.endsWith('session.v3.jsonl.zstd'))
if (file) {
  const events = execFileSync('zstd', ['-dc', join(sessions, file)], { encoding: 'utf8' }).split('\n').filter(Boolean).map(l => JSON.parse(l))
  // Tool results nest their text one level down (content[].type === 'tool-result').
  const textOf = m => m.content.map(c => c.type === 'text' ? c.text : c.type === 'tool-result' ? textOf(c) : '').join('\n')
  const summary = {
    preset: events[0].agentPreset, task,
    sessionModes: events.filter(e => e.type === 'sandbox/mode').map(e => e.data.mode),
    toolCalls: events.filter(e => e.type === 'tool/call').map(e => ({ name: e.data.name, arguments: JSON.parse(e.data.arguments),
      result: (r => r && textOf(r.data.message))(events.find(r => r.type === 'tool/result' && r.data.message.source.callId === e.data.callId)) })),
    finalAnswer: (last => last ? textOf(last.data.message) : null)(events.filter(e => e.type === 'assistant/message').at(-1)),
  }
  const saved = join(here, 'config/logs', `${presetId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  await writeFile(saved, JSON.stringify(summary, null, 2) + '\n')
  console.log(`# summary=${saved}`)
}
