import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { appendFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const at = '2026-10-22T00:00:00.000Z';
const row = (seq, event, rest = {}) => ({ seq, at, event, ...rest });
const line = value => JSON.stringify(value) + '\n';

async function start(t, initial) {
  const dir = await mkdtemp(join(tmpdir(), 'ralph-ui-heldout-'));
  const file = join(dir, 'events.jsonl');
  await writeFile(file, initial);
  const child = spawn(process.execPath, [resolve(process.cwd(), 'server.mjs')], {
    cwd: process.cwd(), env: { ...process.env, PORT: '0', RALPH_EVENTS_FILE: file },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => { child.kill('SIGTERM'); await rm(dir, { recursive: true, force: true }); });
  const port = await new Promise((done, reject) => {
    let text = '';
    const timeout = setTimeout(() => reject(new Error('server start timed out')), 5000);
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`server exit ${code}`)); });
    child.stdout.on('data', chunk => {
      text += chunk;
      const match = /READY (\d+)/.exec(text);
      if (match) { clearTimeout(timeout); done(Number(match[1])); }
    });
  });
  return { file, url: `http://127.0.0.1:${port}` };
}

async function subscribe(t, url, lastId) {
  const controller = new AbortController();
  t.after(() => controller.abort());
  const res = await fetch(url + '/api/events', {
    headers: lastId === undefined ? {} : { 'Last-Event-ID': String(lastId) }, signal: controller.signal,
  });
  assert.equal(res.status, 200);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  async function next(timeout = 4000) {
    const deadline = Date.now() + timeout;
    for (;;) {
      const end = buffer.indexOf('\n\n');
      if (end >= 0) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const fields = Object.fromEntries(frame.split('\n').filter(x => /^(id|event|data):/.test(x))
          .map(x => { const at = x.indexOf(':'); return [x.slice(0, at), x.slice(at + 1).trimStart()]; }));
        if (fields.event || fields.data) return fields;
        continue;
      }
      const remain = deadline - Date.now();
      if (remain <= 0) throw Error('SSE timeout');
      const chunk = await Promise.race([reader.read(), new Promise((_, reject) => setTimeout(() => reject(Error('SSE timeout')), remain))]);
      if (chunk.done) throw Error('SSE closed');
      buffer = (buffer + decoder.decode(chunk.value, { stream: true })).replaceAll('\r\n', '\n');
    }
  }
  return { next };
}

test('two clients observe the same newly appended child and test results', async t => {
  const f = await start(t, line(row(1, 'run/start')));
  const a = await subscribe(t, f.url, 1);
  const b = await subscribe(t, f.url, 1);
  const child = row(2, 'child/end', { round: 1, role: 'implementation', childId: 'impl-1', status: 'ready', summary: 'API complete' });
  const acceptance = row(3, 'acceptance/end', { round: 1, kind: 'assertion-failure', exitCode: 1, testsRun: 4, passed: 3, failed: 1, summary: 'SSE failed' });
  await appendFile(f.file, line(child) + line(acceptance));
  for (const stream of [a, b]) {
    assert.deepEqual(JSON.parse((await stream.next()).data), child);
    assert.deepEqual(JSON.parse((await stream.next()).data), acceptance);
  }
});

test('truncation sends reset and replays the replacement log', async t => {
  const first = row(1, 'run/start');
  const second = row(2, 'round/start', { round: 1, handoff: 'long prior failure detail' });
  const f = await start(t, line(first) + line(second));
  const s = await subscribe(t, f.url);
  assert.equal((await s.next()).id, '1');
  assert.equal((await s.next()).id, '2');
  const replacement = row(1, 'run/end', { status: 'complete' });
  await writeFile(f.file, line(replacement));
  let reset = false;
  for (let i = 0; i < 3; i++) {
    const next = await s.next();
    if (next.event === 'reset') { reset = true; break; }
  }
  assert.equal(reset, true, 'client should be told to reload after truncation');
  const snapshot = await (await fetch(f.url + '/api/snapshot')).json();
  assert.deepEqual(snapshot, { events: [replacement], lastSeq: 1 });
});

test('out-of-order records are never emitted twice', async t => {
  const f = await start(t, [row(1, 'run/start'), row(3, 'round/start', { round: 1 }), row(2, 'child/start', { round: 1, role: 'implementation', childId: 'x' }), row(3, 'round/start', { round: 1 })].map(line).join(''));
  const snapshot = await (await fetch(f.url + '/api/snapshot')).json();
  assert.deepEqual(snapshot.events.map(x => x.seq), [1, 3]);
  assert.equal(snapshot.lastSeq, 3);
});
