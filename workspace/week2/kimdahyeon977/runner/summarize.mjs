import { readFile, writeFile, mkdir, readdir, lstat, realpath } from 'node:fs/promises';
import { resolve, join, relative, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as zlib from 'node:zlib';

// Native records are private input. Only explicitly selected scalar metadata leaves
// this module; no message bodies, tool arguments/results, or transport errors do.
const scalar = value => typeof value === 'string' || typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value)) || value === null;
const pick = (value, keys) => Object.fromEntries(keys.filter(key => value && scalar(value[key])).map(key => [key, value[key]]));
const usageKeys = ['inputTokens', 'outputTokens', 'totalTokens', 'cacheReadTokens', 'cacheWriteTokens', 'reasoningTokens',
  'input_tokens', 'output_tokens', 'total_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'];

export function parseFrames(bytes) {
  if (typeof zlib.zstdDecompressSync !== 'function') throw new Error('Node with zstdDecompressSync required');
  const magic = Buffer.from('28b52ffd', 'hex');
  const starts = [];
  for (let at = 0; (at = bytes.indexOf(magic, at)) !== -1; at += 4) starts.push(at);
  if (!starts.length || starts[0] !== 0) throw new Error('Invalid native zstd stream');
  const chunks = [];
  // Magic may occur inside compressed bytes. Try subsequent candidates until a
  // complete frame decodes, rather than treating every occurrence as a boundary.
  for (let i = 0; i < starts.length;) {
    let decoded = false;
    for (let j = i + 1; j <= starts.length; j++) {
      try {
        chunks.push(zlib.zstdDecompressSync(bytes.subarray(starts[i], starts[j] ?? bytes.length)));
        i = j;
        decoded = true;
        break;
      } catch { /* Candidate was not an actual frame boundary. */ }
    }
    if (!decoded) throw new Error('Truncated or invalid native zstd frame');
  }
  return Buffer.concat(chunks).toString('utf8').split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
}

export function summarizeSession(records) {
  const header = records.find(row => row.type === 'session');
  if (!header?.id) throw new Error('Native session header missing');
  const result = { ...pick(header, ['id', 'parentSession', 'createdAt', 'origin', 'delegationDepth']),
    role: 'unknown', round: null, childSessionIds: [], timeline: [], usage: [] };
  for (const row of records) {
    const data = row.data ?? {};
    if (row.type === 'subagent/descriptor' || row.type === 'subagent/catalog') {
      const custom = /^RALPH (\d+) (implementation|test)$/.exec(data.label ?? '');
      const official = /^Ralph round (\d+)$/.exec(data.label ?? '');
      if (row.type === 'subagent/descriptor') {
        if (custom) { result.round = Number(custom[1]); result.role = custom[2]; }
        if (official) { result.round = Number(official[1]); result.role = 'official-worker'; }
      }
      if (row.type === 'subagent/catalog' && typeof data.childId === 'string') {
        result.childSessionIds.push(data.childId);
        result.timeline.push({ event: row.type, ...pick(row, ['seq', 'time']), childId: data.childId,
          ...(custom ? { round: Number(custom[1]), role: custom[2] } : {}),
          ...(official ? { round: Number(official[1]), role: 'official-worker' } : {}) });
      }
    }
    if (row.type === 'user/message') {
      // Read only this fixed round marker; never retain request text.
      const content = typeof data.content === 'string' ? data.content :
        Array.isArray(data.content) ? data.content.filter(part => part.type === 'text').map(part => part.text ?? '').join('\n') : '';
      const match = /(?:^|\n)Ralph round: (\d+) of (\d+)\./.exec(content);
      if (match) { result.round = Number(match[1]); result.role = 'official-worker'; }
    }
    if (['turn/start', 'turn/end', 'step/start', 'step/end', 'tool/call', 'tool/result'].includes(row.type)) {
      const event = { event: row.type, ...pick(row, ['seq', 'time']), ...pick(data, ['turn', 'step']) };
      if (row.type === 'tool/call') Object.assign(event, pick(data, ['name', 'callId']));
      if (row.type === 'tool/result') Object.assign(event, pick(data.message?.source, ['callId']));
      if (row.type === 'turn/end') Object.assign(event, pick(data.reason, ['kind']));
      result.timeline.push(event);
    }
    const usage = pick(data.usage ?? data.response?.usage ?? (/usage/.test(row.type) ? data : undefined), usageKeys);
    if (Object.keys(usage).length) result.usage.push({ ...pick(row, ['seq', 'time']), ...usage });
  }
  result.childSessionIds = [...new Set(result.childSessionIds)];
  result.startedAt = result.timeline.find(event => event.event === 'turn/start')?.time ?? null;
  result.endedAt = result.timeline.findLast(event => event.event === 'turn/end')?.time ?? null;
  result.toolNames = [...new Set(result.timeline.filter(event => event.event === 'tool/call').map(event => event.name).filter(Boolean))];
  return result;
}

export async function exportSummary(runPath, outputPath) {
  const run = await realpath(resolve(runPath));
  const output = resolve(outputPath);
  const rel = relative(run, output);
  if (!rel || (!rel.startsWith('..' + '/') && !isAbsolute(rel) && rel !== '..')) throw new Error('OUTPUT must be outside RUN');
  async function input(path, optional = false) {
    const full = join(run, path);
    try {
      if (await realpath(full) !== full || !(await lstat(full)).isFile()) throw new Error('Evidence must be regular files without symlinks');
      return await readFile(full);
    } catch (error) { if (optional && error.code === 'ENOENT') return null; throw error; }
  }
  // Completion marker is written by the parent only after process close and TAP.
  const outcome = await input('logs/outcome.json', true);
  if (!outcome) throw new Error('Run is not complete: logs/outcome.json missing');
  JSON.parse(outcome.toString());
  const manifest = JSON.parse((await input('manifest.json')).toString());
  const files = new Map([['logs/outcome.json', outcome]]);
  for (const path of ['manifest.json', 'logs/controller-result.json', 'logs/final-acceptance.tap', 'logs/bootstrap.jsonl', 'workspace/cli.mjs', 'task.txt']) {
    const bytes = await input(path, true);
    if (bytes) files.set(path, bytes);
  }
  const sessions = [];
  async function visit(path) {
    let entries;
    try { entries = await readdir(join(run, path), { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) await visit(child);
      else if (entry.isFile() && entry.name === 'session.v3.jsonl.zstd') sessions.push(summarizeSession(parseFrames(await input(child))));
    }
  }
  await visit('dsh-home/sessions');
  for (const session of sessions) {
    const catalog = sessions.flatMap(candidate => candidate.timeline).find(event => event.childId === session.id && event.round);
    if (catalog && session.round === null) { session.round = catalog.round; session.role = catalog.role; }
    const parent = sessions.find(candidate => candidate.id === session.parentSession);
    if (parent && !parent.childSessionIds.includes(session.id)) parent.childSessionIds.push(session.id);
    if (!session.parentSession) session.role = 'controller';
  }
  sessions.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id));
  const summary = { schemaVersion: 1, mode: manifest.mode, sessions,
    note: 'Only observed native metadata. Null round/role unknown means no explicit marker; no inferred rounds or token estimates.' };
  // Require an empty destination so earlier private/raw artifacts cannot survive.
  await mkdir(output, { recursive: true });
  if ((await readdir(output)).length) throw new Error('OUTPUT must be empty');
  for (const [path, bytes] of files) {
    await mkdir(dirname(join(output, path)), { recursive: true });
    await writeFile(join(output, path), bytes, { flag: 'wx' });
  }
  await writeFile(join(output, 'native-summary.json'), JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
  return summary;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [run, output, ...extra] = process.argv.slice(2);
  if (!run || !output || extra.length) throw new Error('Usage: node runner/summarize.mjs RUN OUTPUT');
  await exportSummary(run, output);
}
