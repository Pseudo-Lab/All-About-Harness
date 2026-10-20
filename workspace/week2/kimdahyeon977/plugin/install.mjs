import { createRequire } from 'node:module';
import { readFile, writeFile, realpath, mkdir, access } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Generates inside preset/generated only, preserving portable sources and home.
 * node install.mjs HARNESS WORKSPACE FROZEN_ROOT TEST_FILE [TEST_FILE...]
 */
const [harnessArg, workspaceArg, frozenRoot, ...testFiles] = process.argv.slice(2);
if (!harnessArg || !workspaceArg || !frozenRoot || !testFiles.length) throw new Error('Usage: node install.mjs HARNESS WORKSPACE FROZEN_ROOT TEST_FILE...');
const here = dirname(fileURLToPath(import.meta.url));
const preset = resolve(here, '../preset');
const output = resolve(preset, 'generated');
const harness = await realpath(harnessArg);
const workspace = await realpath(workspaceArg);
for (const file of testFiles) {
  const rel = relative(resolve(workspace, frozenRoot), resolve(workspace, file));
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Test files must be under frozen root');
}
const require = createRequire(resolve(harness, 'package.json'));
async function packagePath(pkg) {
  try { const path = require.resolve(pkg); await access(path); return path; }
  catch {
    // Source checkout workspaces are not necessarily linked in the root manifest.
    const mapping = { '@deepseek-ai/dsh-tools': 'packages/core/tools', '@deepseek-ai/dsh-persona': 'packages/preset/persona', '@deepseek-ai/dsh-tool-bash': 'packages/shell/tool-bash', '@deepseek-ai/dsh-tool-fs': 'packages/fs/tool-fs' };
    if (!mapping[pkg]) throw new Error(`Unresolved package ${pkg}`);
    const dir = resolve(harness, mapping[pkg]);
    const meta = JSON.parse(await readFile(resolve(dir, 'package.json'), 'utf8'));
    const path = resolve(dir, meta.main);
    await access(path);
    return path;
  }
}
await mkdir(output, { recursive: true });
const tools = pathToFileURL(await packagePath('@deepseek-ai/dsh-tools')).href;
const source = (await readFile(resolve(here, 'index.mjs'), 'utf8'))
  .replace("'@deepseek-ai/dsh-tools'", JSON.stringify(tools))
  .replace("'./core.mjs'", JSON.stringify(pathToFileURL(resolve(here, 'core.mjs')).href))
  .replace("'./host.mjs'", JSON.stringify(pathToFileURL(resolve(here, 'host.mjs')).href));
await writeFile(resolve(output, 'ralph.generated.mjs'), source);
let yaml = await readFile(resolve(preset, 'agent.cordis.yml'), 'utf8');
yaml = yaml.replace(/    workspace:.*\n    frozenRoots:.*\n    testFiles:.*/, `    workspace: ${JSON.stringify(workspace)}\n    frozenRoots: ${JSON.stringify([frozenRoot])}\n    testFiles: ${JSON.stringify(testFiles)}`);
for (const pkg of ['@deepseek-ai/dsh-persona', '@deepseek-ai/dsh-tool-bash', '@deepseek-ai/dsh-tool-fs']) {
  yaml = yaml.replace(`name: '${pkg}'`, `name: '${pathToFileURL(await packagePath(pkg)).href}'`);
}
yaml = yaml.replace("name: './ralph.generated.mjs'", `name: '${pathToFileURL(resolve(output, 'ralph.generated.mjs')).href}'`);
await writeFile(resolve(output, 'agent.cordis.yml'), yaml);
await writeFile(resolve(output, 'preset.yml'), await readFile(resolve(preset, 'preset.yml')));
console.log(`Prepared ${output}; host provides subagents + spawn, tools, fs, bash and model route. No home files changed.`);
