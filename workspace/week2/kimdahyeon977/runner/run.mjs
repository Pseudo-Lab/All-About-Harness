import { mkdir, readFile, writeFile, copyFile, readdir, symlink, chmod, mkdtemp } from 'node:fs/promises';
import { existsSync, createWriteStream } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { parseEnv } from 'node:util';
import { buildCreatorSource } from './creator-source.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const assignment = dirname(here);
const repo = resolve(here, '../../../..');
const harness = resolve(process.env.HARNESS_ROOT ?? join(repo, 'deepseek-harness'));
const [mode, option] = process.argv.slice(2);
if (!['custom', 'official'].includes(mode) || (option && !['--prepare', '--check'].includes(option)) || process.argv.length > 4) {
  throw new Error('Usage: node runner/run.mjs custom|official [--prepare|--check]');
}
const patch = resolve(process.env.BEDROCK_PATCH ?? join(here, 'bedrock.patch.yml'));
const base = resolve(process.env.RUN_ROOT ?? '/tmp/week2-harness-runs');
if (!(base.startsWith('/tmp/') || base.startsWith(repo + '/'))) throw new Error('RUN_ROOT must be inside workspace or /tmp');
await mkdir(base, { recursive: true, mode: 0o700 });
const run = await mkdtemp(join(base, mode + '-'));
await chmod(run, 0o700);
const workspace = join(run, 'workspace');
const home = join(run, 'dsh-home');
const logs = join(run, 'logs');
for (const path of [workspace, home, logs, join(workspace, 'acceptance'), join(run, 'frozen')]) await mkdir(path, { recursive: true, mode: 0o700 });
const scenario = process.env.RALPH_SCENARIO ?? 'staged';
if (!['single', 'staged', 'planner'].includes(scenario)) throw new Error('RALPH_SCENARIO must be single, staged, or planner');
const taskFile = { single: 'task.txt', staged: 'task-staged.txt', planner: 'task-planner.txt' }[scenario];
const acceptanceNames = scenario === 'planner' ? ['planner.test.mjs', 'planner.md'] : ['todo.test.mjs'];
const testName = acceptanceNames[0];
const acceptanceFiles = new Map(await Promise.all(acceptanceNames.map(async name =>
  [name, await readFile(join(assignment, 'acceptance', name))])));
const task = await readFile(join(here, taskFile));
const creatorSource = await buildCreatorSource(mode);
const creatorCode = join(run, 'creator.host.js');
await writeFile(creatorCode, creatorSource, { mode: 0o600 });
const runtimeConfig = { workspace, frozenRoots: ['acceptance'], testFiles: [`acceptance/${testName}`], maxRounds: 5, provider: 'spawn' };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const [name, bytes] of acceptanceFiles) {
  for (const dest of [join(workspace, 'acceptance', name), join(run, 'frozen', name)]) {
    await writeFile(dest, bytes, { mode: 0o444 });
  }
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
const presetId = 'experiment-ralph';
const presetRoots = join(run, 'presets');
const require = createRequire(join(harness, 'packages/boot/app-boot/package.json'));
const yaml = require('js-yaml');
const authoredRows = yaml.load(await readFile(join(assignment, 'preset/agent.cordis.yml'), 'utf8'));
// Both controllers mount these exact rows. Keep the child coding surface small;
// the Custom controller's scoped guard limits its implementation/test roles.
const allowed = new Set(['persona', 'tool-bash', 'tool-fs']);
const sharedRows = authoredRows.filter(row => allowed.has(row.id));
for (const id of allowed) {
  if (sharedRows.filter(row => row.id === id).length !== 1) throw new Error(`preset/ must declare exactly one ${id}`);
}
sharedRows.push(
  { id: 'ralph-workflow', name: 'cordis:group', group: true, isolate: { workflowEngine: true }, config: [
    { id: 'workflow-worker-thread', name: '@deepseek-ai/dsh-workflow-worker-thread', config: { provider: 'spawn' } },
    { id: 'tool-ralph', name: '@deepseek-ai/dsh-tool-ralph', config: { subagentProvider: 'spawn', maxRounds: 5 } },
  ] },
  { id: 'tool-cordis', name: '@deepseek-ai/dsh-tool-cordis' },
);
const generated = join(presetRoots, presetId);
await mkdir(generated, { recursive: true });
const presetMetadata = await readFile(join(assignment, 'preset/preset.yml'));
const presetComposition = Buffer.from('# Shared Creator and official RALPH experiment preset.\n' + yaml.dump(sharedRows));
await writeFile(join(generated, 'preset.yml'), presetMetadata);
await writeFile(join(generated, 'agent.cordis.yml'), presetComposition);

const disabled = ['headless-runner', 'session-title-llm', 'tool-jobs', 'tool-fs', 'tool-fs-search', 'skill-filesystem', 'tool-skill', 'command-goal', 'tool-goal', 'plan-mode', 'compaction-basic', 'command-compact', 'tool-result-pruner', 'tool-subagent-control', 'tool-subagent-list-agents', 'tool-subagent', 'tool-subagent-fork', 'workflow-worker-thread', 'tool-workflow', 'tool-ralph', 'agent-instructions', 'tool-todo', 'tool-web'];
const rows = disabled.map(id => ({ id, disabled: true }));
rows.push({ id: 'tools', config: { mode: 'native' } });
const inserts = [
  { id: 'subagent-model-selection-settings', name: '@deepseek-ai/dsh-tool-subagent/model-selection-settings' },
  { id: 'creator-host-runner', name: '@deepseek-ai/dsh-cordis-host-runner' },
  { id: 'experiment-presets', name: '@deepseek-ai/dsh-agent-presets', config: {
    default: presetId, includeUserRoot: false, roots: [{ path: presetRoots, trust: 'user' }],
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
  maxRounds: 5, cliInitiallyPresent: false,
  initialFiles: Object.fromEntries([...acceptanceFiles].map(([name, bytes]) => [`acceptance/${name}`, hash(bytes)])),
  taskSha256: hash(task), acceptanceSha256: hash(acceptanceFiles.get(testName)),
  presetSha256: hash(presetComposition), presetMetadataSha256: hash(presetMetadata), adapterSha256: hash(adapterSource),
  creatorSourceSha256: hash(creatorSource) };
await writeFile(join(run, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(run);
if (option === '--prepare') process.exit(0);
if (!existsSync(patch)) throw new Error('Bedrock patch missing');
// Read only the Bedrock keys needed for this run, even when BEDROCK_ENV points
// at a larger application .env file. Never copy that file into artifacts.
const modelEnv = resolve(process.env.BEDROCK_ENV ?? '/home/user/.dsh/bedrock.env');
if (option !== '--check' && existsSync(modelEnv)) {
  const values = parseEnv(await readFile(modelEnv, 'utf8'));
  for (const [target, sources] of Object.entries({
    AWS_ACCESS_KEY_ID: ['BEDROCK_ACCESS_KEY', 'AWS_ACCESS_KEY_ID'],
    AWS_SECRET_ACCESS_KEY: ['BEDROCK_SECRET_KEY', 'AWS_SECRET_ACCESS_KEY'],
    AWS_REGION: ['BEDROCK_REGION', 'AWS_REGION'],
  })) {
    if (!process.env[target]) {
      const source = sources.find(key => values[key]);
      if (source) process.env[target] = values[source];
    }
  }
  if (!process.env.AWS_DEFAULT_REGION && process.env.AWS_REGION) process.env.AWS_DEFAULT_REGION = process.env.AWS_REGION;
}
const env = { ...process.env, DSH_HOME: home, DSH_TOOLS_MODE: 'native', DSH_TELEMETRY_DISABLED: '1',
  DSH_TELEMETRY_MODE: 'DISABLED', TODO_CLI: join(workspace, 'cli.mjs'),
  XDG_CACHE_HOME: join(run, 'cache'), npm_config_cache: join(run, 'npm-cache'),
};
delete env.BEDROCK_ENV;
delete env.BEDROCK_ACCESS_KEY;
delete env.BEDROCK_SECRET_KEY;
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
const frozenUnchanged = (await Promise.all([...acceptanceFiles].flatMap(([name, bytes]) =>
  [join(workspace, 'acceptance', name), join(run, 'frozen', name)].map(async path =>
    hash(await readFile(path)) === hash(bytes))))).every(Boolean);
let acceptance = null;
if (option !== '--check') {
  const checked = spawnSync(process.execPath, ['--test', '--test-reporter=tap', join(run, 'frozen', testName)], {
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
