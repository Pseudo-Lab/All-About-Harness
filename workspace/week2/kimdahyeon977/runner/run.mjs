import { mkdir, readFile, writeFile, copyFile, readdir, symlink, chmod, mkdtemp } from 'node:fs/promises';
import { existsSync, createWriteStream } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { buildCreatorSource } from './creator-source.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const assignment = dirname(here);
const repo = resolve(here, '../../../..');
const harness = resolve(process.env.HARNESS_ROOT ?? join(repo, 'deepseek-harness'));
const [mode, option] = process.argv.slice(2);
if (!['custom', 'official'].includes(mode) || (option && !['--prepare', '--check'].includes(option)) || process.argv.length > 4) {
  throw new Error('Usage: node runner/run.mjs custom|official [--prepare|--check]');
}
const patch = resolve(process.env.BEDROCK_PATCH ?? '/home/user/.dsh/bedrock.patch.yml');
const base = resolve(process.env.RUN_ROOT ?? '/tmp/week2-harness-runs');
if (!(base.startsWith('/tmp/') || base.startsWith(repo + '/'))) throw new Error('RUN_ROOT must be inside workspace or /tmp');
await mkdir(base, { recursive: true, mode: 0o700 });
const run = await mkdtemp(join(base, mode + '-'));
await chmod(run, 0o700);
const workspace = join(run, 'workspace');
const home = join(run, 'dsh-home');
const logs = join(run, 'logs');
for (const path of [workspace, home, logs, join(workspace, 'acceptance'), join(run, 'frozen')]) await mkdir(path, { recursive: true, mode: 0o700 });
const originalTest = join(assignment, 'acceptance/todo.test.mjs');
const initialTest = await readFile(originalTest);
const scenario = process.env.RALPH_SCENARIO ?? 'staged';
if (!['single', 'staged'].includes(scenario)) throw new Error('RALPH_SCENARIO must be single or staged');
const task = await readFile(join(here, scenario === 'single' ? 'task.txt' : 'task-staged.txt'));
const creatorSource = await buildCreatorSource(mode);
const creatorCode = join(run, 'creator.host.js');
await writeFile(creatorCode, creatorSource, { mode: 0o600 });
const runtimeConfig = { workspace, frozenRoots: ['acceptance'], testFiles: ['acceptance/todo.test.mjs'], maxRounds: 5, provider: 'spawn' };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const dest of [join(workspace, 'acceptance/todo.test.mjs'), join(run, 'frozen/todo.test.mjs')]) {
  await writeFile(dest, initialTest, { mode: 0o444 });
}
await writeFile(join(run, 'task.txt'), task);

// Copy only adapter code, never example/cli.mjs. Resolve its one Harness import
// through a private local node_modules link; do not touch the user's installation.
const adapter = join(run, 'plugin');
await mkdir(adapter);
for (const entry of await readdir(join(assignment, 'plugin'))) {
  if (entry.endsWith('.mjs') && !entry.includes('test') && !entry.includes('install')) await copyFile(join(assignment, 'plugin', entry), join(adapter, entry));
}
await mkdir(join(adapter, 'node_modules/@deepseek-ai'), { recursive: true });
await symlink(join(harness, 'packages/core/tools'), join(adapter, 'node_modules/@deepseek-ai/dsh-tools'));
const adapterFile = join(adapter, 'index.mjs');
const adapterSource = await readFile(adapterFile, 'utf8');
const presetId = mode === 'custom' ? 'custom-ralph' : 'cordis';
const presetRoots = join(run, 'presets');
if (mode === 'custom') {
  const require = createRequire(join(harness, 'packages/boot/app-boot/package.json'));
  const yaml = require('js-yaml');
  const authoredRows = yaml.load(await readFile(join(assignment, 'preset/agent.cordis.yml'), 'utf8'));
  // Keep the authored coding surface, without inheriting Creator's delegation
  // group: its scoped tool registrations can escape a global child tool filter.
  const allowed = new Set(['persona', 'tool-bash', 'tool-fs']);
  const authored = authoredRows.filter(row => allowed.has(row.id));
  for (const id of allowed) {
    if (authored.filter(row => row.id === id).length !== 1) throw new Error(`preset/ must declare exactly one ${id}`);
  }
  const generated = join(presetRoots, presetId);
  await mkdir(generated, { recursive: true });
  await copyFile(join(assignment, 'preset/preset.yml'), join(generated, 'preset.yml'));
  authored.push({ id: 'tool-cordis', name: '@deepseek-ai/dsh-tool-cordis' });
  await writeFile(join(generated, 'agent.cordis.yml'), '# Authored coding preset plus Creator define/run tools; no delegation group.\n' + yaml.dump(authored));
}

const disabled = ['headless-runner', 'session-title-llm', 'tool-jobs', 'tool-fs', 'tool-fs-search', 'skill-filesystem', 'tool-skill', 'command-goal', 'tool-goal', 'plan-mode', 'compaction-basic', 'command-compact', 'tool-result-pruner', 'tool-subagent-control', 'tool-subagent-list-agents', 'tool-subagent', 'tool-subagent-fork', 'workflow-worker-thread', 'tool-workflow', 'tool-ralph', 'agent-instructions', 'tool-todo', 'tool-web'];
const rows = disabled.map(id => ({ id, disabled: true }));
rows.push({ id: 'tools', config: { mode: 'native' } });
const inserts = [
  { id: 'subagent-model-selection-settings', name: '@deepseek-ai/dsh-tool-subagent/model-selection-settings' },
  { id: 'creator-host-runner', name: '@deepseek-ai/dsh-cordis-host-runner' },
  { id: 'experiment-presets', name: '@deepseek-ai/dsh-agent-presets', config: {
    default: presetId, includeUserRoot: false, roots: mode === 'custom' ? [{ path: presetRoots, trust: 'user' }] : [],
  } },
];
inserts.push({ id: 'experiment-bootstrap', name: join(here, 'bootstrap.mjs'), config: {
  mode, presetId, check: option === '--check', events: join(logs, 'bootstrap.jsonl'), task: join(run, 'task.txt'),
  creatorCode, runtimeConfig, runtimeModule: adapterFile, result: join(logs, 'controller-result.json'),
} });
rows.push({ insert: inserts });
const overlay = join(run, 'experiment.patch.json');
await writeFile(overlay, JSON.stringify(rows, null, 2));
const manifest = { mode, scenario, presetId, state: 'prepared-not-executed', run, workspace, dshHome: home,
  provider: 'amazon-bedrock', model: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0', modelPatch: patch,
  maxRounds: 5, cliInitiallyPresent: false, initialFiles: { 'acceptance/todo.test.mjs': hash(initialTest) },
  taskSha256: hash(task), acceptanceSha256: hash(initialTest), adapterSha256: hash(adapterSource),
  creatorSourceSha256: hash(creatorSource) };
await writeFile(join(run, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(run);
if (option === '--prepare') process.exit(0);
if (!existsSync(patch)) throw new Error('Bedrock patch missing');
// Load the existing local credential file into memory; never copy it into artifacts.
const modelEnv = resolve(process.env.BEDROCK_ENV ?? '/home/user/.dsh/bedrock.env');
if (option !== '--check' && existsSync(modelEnv)) process.loadEnvFile(modelEnv);
const env = { ...process.env, DSH_HOME: home, DSH_TOOLS_MODE: 'native', DSH_TELEMETRY_DISABLED: '1',
  DSH_TELEMETRY_MODE: 'DISABLED', TODO_CLI: join(workspace, 'cli.mjs'),
  XDG_CACHE_HOME: join(run, 'cache'), npm_config_cache: join(run, 'npm-cache'),
};
if (option === '--check') {
  for (const key of Object.keys(env)) if (/API_KEY|TOKEN|SECRET|PASSWORD|^AWS_ACCESS_KEY_ID$|^AWS_PROFILE$/.test(key)) delete env[key];
  env.AWS_EC2_METADATA_DISABLED = 'true';
  env.AWS_CONFIG_FILE = join(run, 'absent-aws-config');
  env.AWS_SHARED_CREDENTIALS_FILE = join(run, 'absent-aws-credentials');
}
const stdout = createWriteStream(join(logs, 'stdout.log'), { mode: 0o600 });
const stderr = createWriteStream(join(logs, 'stderr.log'), { mode: 0o600 });
const child = spawn(process.execPath, [join(harness, 'apps/cli/lib/bin.js'), '--profile', 'headless', '--patch', patch, '--patch', overlay, 'experiment task'], {
  cwd: workspace, env, stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.pipe(stdout); child.stderr.pipe(stderr);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
const status = await new Promise((done, reject) => { child.on('error', reject); child.on('close', (code, signal) => done({ code, signal })); });
const frozenUnchanged = hash(await readFile(join(workspace, 'acceptance/todo.test.mjs'))) === hash(initialTest) &&
  hash(await readFile(join(run, 'frozen/todo.test.mjs'))) === hash(initialTest);
let acceptance = null;
if (option !== '--check') {
  const checked = spawnSync(process.execPath, ['--test', '--test-reporter=tap', join(run, 'frozen/todo.test.mjs')], {
    cwd: workspace, env, encoding: 'utf8', timeout: 120000, maxBuffer: 4_000_000,
  });
  await writeFile(join(logs, 'final-acceptance.tap'), (checked.stdout ?? '') + (checked.stderr ?? ''));
  acceptance = { exitCode: checked.status, signal: checked.signal, spawnError: Boolean(checked.error) };
}
let controllerStatus = 'unavailable';
try {
  const controller = JSON.parse(await readFile(join(logs, 'controller-result.json'), 'utf8')).value;
  controllerStatus = mode === 'custom' ? controller.status : controller.result?.status;
} catch (error) { if (error.code !== 'ENOENT') throw error; }
await writeFile(join(logs, 'outcome.json'), JSON.stringify({ ...status, checkOnly: option === '--check', controllerStatus, frozenUnchanged, acceptance }, null, 2) + '\n');
process.exitCode = status.code === 0 && frozenUnchanged && (option === '--check' || controllerStatus === 'complete' && acceptance?.exitCode === 0) ? 0 : 1;
