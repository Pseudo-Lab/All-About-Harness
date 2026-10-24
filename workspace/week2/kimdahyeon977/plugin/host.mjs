import { createHash } from 'node:crypto';
import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { spawn } from 'node:child_process';

/** Hash entire frozen roots, including directory membership; reject symlinks. */
export async function snapshotTests(workspace, roots) {
  if (!Array.isArray(roots) || !roots.length) throw new Error('Frozen roots required');
  const base = await realpath(workspace);
  const hash = createHash('sha256');
  async function visit(path) {
    const rel = relative(base, path);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Frozen roots must be inside workspace');
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) throw new Error('Frozen symlinks unsupported');
    const canonical = await realpath(path);
    if (canonical !== path) throw new Error('Frozen ancestor symlinks unsupported');
    hash.update(JSON.stringify([rel, stat.mode, stat.isDirectory() ? 'directory' : 'file']));
    if (stat.isDirectory()) for (const name of (await readdir(path)).sort()) await visit(resolve(path, name));
    else if (stat.isFile()) hash.update(await readFile(path));
    else throw new Error('Unsupported frozen entry');
  }
  for (const root of [...roots].sort()) await visit(resolve(base, root));
  return hash.digest('hex');
}

/** Fixed Node test runner; parses TAP counters rather than trusting a model. */
export function runAcceptance({ workspace, testFiles, signal, timeoutMs = 120000 }) {
  return new Promise((resolveResult, reject) => {
    const acceptanceEnv = { ...process.env, TODO_CLI: resolve(workspace, 'cli.mjs') };
    // Nested node:test execution must start an independent test runner.
    delete acceptanceEnv.NODE_TEST_CONTEXT;
    const child = spawn(process.execPath, ['--test', '--test-reporter=tap', ...testFiles], {
      cwd: workspace, env: acceptanceEnv, signal, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let error;
    let timedOut = false;
    const kill = () => {
      try { if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); }
      catch (failure) { if (failure.code !== 'ESRCH') error = failure; }
    };
    const abort = () => kill();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => { timedOut = true; kill(); }, timeoutMs);
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
      output += chunk.toString();
      if (output.length > 2_000_000) { error = new Error('Acceptance output limit'); kill(); }
    });
    child.on('error', failure => { error = failure; });
    child.on('close', code => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (signal?.aborted) { reject(signal.reason ?? new Error('Cancelled')); return; }
      const wrappers = [...output.matchAll(/^# Subtest: (.+)$/gm)].filter(match => testFiles.some(file => resolve(workspace, file) === resolve(workspace, match[1]))).length;
      const skipped = Number(output.match(/^# skipped (\d+)\s*$/m)?.[1] ?? 0);
      const testsRun = Math.max(0, Number(output.match(/^# tests (\d+)\s*$/m)?.[1] ?? 0) - wrappers - skipped);
      const failed = Number(output.match(/^# fail (\d+)\s*$/m)?.[1] ?? 0);
      const infra = error || timedOut || testsRun < 1 || /failureType: 'cancelledByParent'/.test(output);
      resolveResult({ exitCode: infra ? (Number.isInteger(code) && code !== 0 ? code : 1) : Number.isInteger(code) ? code : 1, testsRun,
        kind: infra ? 'infrastructure-error' : code === 0 ? 'passed' : failed > 0 && /ERR_ASSERTION/.test(output) ? 'assertion-failure' : 'infrastructure-error',
        summary: output.slice(-12000) });
    });
  });
}
