import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { appendFile, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const serverFile = resolve(process.cwd(), 'server.mjs');
const at = '2026-10-22T00:00:00.000Z';
const event = (seq, kind, extra = {}) => ({ seq, at, event: kind, ...extra });
const line = value => JSON.stringify(value) + '\n';
const failure = message => new assert.AssertionError({ message });

async function fixture(t, initial = '') {
  const dir = await mkdtemp(join(tmpdir(), 'ralph-live-ui-'));
  const file = join(dir, 'events.jsonl');
  if (initial !== null) await writeFile(file, initial);
  let stderr = '';
  const child = spawn(process.execPath, [serverFile], {
    cwd: process.cwd(), env: { ...process.env, PORT: '0', RALPH_EVENTS_FILE: file },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', chunk => { stderr += chunk; });
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await Promise.race([new Promise(done => child.once('exit', done)), new Promise(done => setTimeout(done, 1500))]);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    await rm(dir, { recursive: true, force: true });
  });
  const port = await new Promise((done, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(failure(`server did not become ready: ${stderr}`)), 5000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(failure(`server exited ${code}: ${stderr}`)); });
    child.stdout.on('data', chunk => {
      buffer += chunk;
      const found = /(?:^|\n)READY (\d+)(?:\r?\n|$)/.exec(buffer);
      if (found) { clearTimeout(timer); done(Number(found[1])); }
    });
  });
  const url = `http://127.0.0.1:${port}`;
  return { file, url, child, append: value => appendFile(file, line(value)) };
}

async function stream(t, url, lastId) {
  const controller = new AbortController();
  t.after(() => controller.abort());
  const response = await fetch(url + '/api/events', {
    headers: lastId === undefined ? {} : { 'Last-Event-ID': String(lastId) }, signal: controller.signal,
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  async function next(timeout = 3000) {
    const until = Date.now() + timeout;
    for (;;) {
      const end = buffer.indexOf('\n\n');
      if (end >= 0) {
        const frame = buffer.slice(0, end).replaceAll('\r', '');
        buffer = buffer.slice(end + 2);
        const fields = Object.fromEntries(frame.split('\n').filter(row => /^(id|event|data):/.test(row))
          .map(row => { const at = row.indexOf(':'); return [row.slice(0, at), row.slice(at + 1).trimStart()]; }));
        if (fields.event || fields.data) return fields;
        continue;
      }
      const left = until - Date.now();
      if (left <= 0) throw failure('SSE event timeout');
      let timer;
      const chunk = await Promise.race([
        reader.read(), new Promise((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(failure('SSE event timeout')); }, left);
        }),
      ]).finally(() => clearTimeout(timer));
      if (chunk.done) throw failure('SSE stream closed');
      buffer = (buffer + decoder.decode(chunk.value, { stream: true })).replaceAll('\r\n', '\n');
    }
  }
  return { next, close: () => controller.abort() };
}

test('serves a runnable dashboard and rejects unknown paths', async t => {
  const { url } = await fixture(t);
  const health = await fetch(url + '/health');
  assert.deepEqual(await health.json(), { ok: true });
  const page = await fetch(url + '/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type') ?? '', /text\/html/);
  const html = await page.text();
  assert.match(html, /<main\b/i);
  assert.match(html, /<h1\b/i);
  assert.match(html, /app\.js/);
  assert.match(html, /style\.css/);
  assert.match((await fetch(url + '/app.js')).headers.get('content-type') ?? '', /javascript/);
  assert.match((await fetch(url + '/style.css')).headers.get('content-type') ?? '', /text\/css/);
  assert.equal((await fetch(url + '/not-found')).status, 404);
  assert.equal((await fetch(url + '/..%2F..%2Fetc%2Fpasswd')).status, 404);
  assert.equal((await fetch(url + '/events.jsonl')).status, 404);
});

test('empty or missing event log produces an honest empty snapshot', async t => {
  const f = await fixture(t, null);
  const response = await fetch(f.url + '/api/snapshot');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  assert.deepEqual(await response.json(), { events: [], lastSeq: 0 });
});

test('snapshot preserves ordered real run, child, host-test, and handoff events', async t => {
  const rows = [
    event(1, 'run/start'), event(2, 'round/start', { round: 1, handoff: '' }),
    event(3, 'child/start', { round: 1, role: 'implementation', childId: 'impl-1' }),
    event(4, 'child/end', { round: 1, role: 'implementation', childId: 'impl-1', status: 'ready', summary: 'built server' }),
    event(5, 'child/end', { round: 1, role: 'test', childId: 'test-1', status: 'fail', summary: 'SSE missing' }),
    event(6, 'acceptance/end', { round: 1, kind: 'assertion-failure', exitCode: 1, testsRun: 8, passed: 7, failed: 1, summary: 'SSE missing' }),
    event(7, 'round/start', { round: 2, handoff: 'SSE missing' }),
  ];
  const f = await fixture(t, rows.map(line).join(''));
  assert.deepEqual(await (await fetch(f.url + '/api/snapshot')).json(), { events: rows, lastSeq: 7 });
});

test('SSE replays history, follows appended lines, and withholds a partial line', async t => {
  const first = event(1, 'run/start');
  const second = event(2, 'round/start', { round: 1, handoff: '' });
  const f = await fixture(t, line(first));
  const s = await stream(t, f.url);
  const replay = await s.next();
  assert.equal(replay.id, '1');
  assert.equal(replay.event, 'ralph');
  assert.deepEqual(JSON.parse(replay.data), first);
  const text = JSON.stringify(second);
  await appendFile(f.file, text.slice(0, 18));
  const pending = s.next(3000);
  await new Promise(done => setTimeout(done, 250));
  await appendFile(f.file, text.slice(18) + '\n');
  const live = await pending;
  assert.equal(live.id, '2');
  assert.deepEqual(JSON.parse(live.data), second);
});

test('Last-Event-ID resumes without replaying earlier events', async t => {
  const f = await fixture(t, [event(1, 'run/start'), event(2, 'round/start', { round: 1 })].map(line).join(''));
  const s = await stream(t, f.url, 1);
  assert.equal((await s.next()).id, '2');
  await f.append(event(3, 'child/start', { round: 1, role: 'implementation', childId: 'worker-1' }));
  assert.equal((await s.next()).id, '3');
});

test('malformed and duplicate complete lines do not crash the stream', async t => {
  const good = event(1, 'run/start');
  const later = event(2, 'round/start', { round: 1, handoff: '' });
  const f = await fixture(t, line(good) + '{bad-json\n' + line(good) + line(later));
  assert.deepEqual(await (await fetch(f.url + '/api/snapshot')).json(), { events: [good, later], lastSeq: 2 });
  const s = await stream(t, f.url);
  assert.deepEqual([(await s.next()).id, (await s.next()).id], ['1', '2']);
});

test('snapshot ignores out-of-order sequence numbers', async t => {
  const f = await fixture(t, [
    event(1, 'run/start'),
    event(3, 'round/start', { round: 1 }),
    event(2, 'child/start', { round: 1, role: 'implementation', childId: 'late' }),
    event(3, 'round/start', { round: 1 }),
  ].map(line).join(''));
  const snapshot = await (await fetch(f.url + '/api/snapshot')).json();
  assert.deepEqual(snapshot.events.map(event => event.seq), [1, 3]);
  assert.equal(snapshot.lastSeq, 3);
});

test('reader makes a replacement log available immediately after truncation', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'ralph-ui-truncation-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'events.jsonl');
  await writeFile(file, line(event(1, 'run/start')) + line(event(2, 'round/start', { round: 1 })));
  const { EventFileReader } = await import(pathToFileURL(resolve(process.cwd(), 'lib/file-reader.mjs')).href);
  const reader = new EventFileReader(file);
  await reader.ready();
  reader.shutdown();
  const replacement = event(1, 'run/end', { status: 'complete' });
  await writeFile(file, line(replacement));
  await reader.checkForNewEvents();
  assert.deepEqual(await reader.getSnapshot(), { events: [replacement], lastSeq: 1 });
});

test('SSE sends reset before exactly one copy of each replacement event', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'ralph-ui-reset-order-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'events.jsonl');
  await writeFile(file, line(event(1, 'run/start')) + line(event(2, 'round/start', { round: 1 })));
  const { EventFileReader } = await import(pathToFileURL(resolve(process.cwd(), 'lib/file-reader.mjs')).href);
  const { EventStream } = await import(pathToFileURL(resolve(process.cwd(), 'lib/event-stream.mjs')).href);
  const reader = new EventFileReader(file);
  await reader.ready();
  reader.shutdown();
  const stream = new EventStream(reader);
  t.after(() => stream.shutdown());
  const writes = [];
  const unsubscribe = await stream.subscribe({ write: value => writes.push(value), end: () => {} });
  t.after(unsubscribe);
  writes.length = 0;
  await writeFile(file, line(event(1, 'run/end', { status: 'complete' })));
  await reader.checkForNewEvents();
  await new Promise(done => setImmediate(done));
  const transcript = writes.join('');
  assert.ok(transcript.includes('event: reset\n\n'), 'missing reset event');
  assert.ok(transcript.indexOf('event: reset\n\n') < transcript.indexOf('id: 1\n'), 'replacement arrived before reset');
  assert.equal((transcript.match(/id: 1\n/g) ?? []).length, 1, 'replacement event was duplicated');
});

test('a missing event file can be created while a client is connected', async t => {
  const f = await fixture(t, null);
  const s = await stream(t, f.url);
  const first = event(1, 'run/start');
  await writeFile(f.file, line(first));
  assert.deepEqual(JSON.parse((await s.next(2000)).data), first);
  assert.deepEqual(await (await fetch(f.url + '/api/snapshot')).json(), { events: [first], lastSeq: 1 });
});

test('atomic event file replacement resets and follows the new file', async t => {
  const f = await fixture(t, line(event(1, 'run/start')) + line(event(2, 'round/start', { round: 1 })));
  const s = await stream(t, f.url);
  assert.equal((await s.next()).id, '1');
  assert.equal((await s.next()).id, '2');
  const replacement = event(1, 'run/end', { status: 'complete' });
  const nextFile = f.file + '.next';
  await writeFile(nextFile, line(replacement));
  await rename(nextFile, f.file);
  assert.equal((await s.next(2000)).event, 'reset');
  assert.deepEqual(JSON.parse((await s.next(2000)).data), replacement);
  assert.deepEqual(await (await fetch(f.url + '/api/snapshot')).json(), { events: [replacement], lastSeq: 1 });
});
