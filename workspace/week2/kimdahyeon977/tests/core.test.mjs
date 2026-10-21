import test from 'node:test';
import assert from 'node:assert/strict';
import { runRalph } from '../plugin/core.mjs';

const evidence = (exitCode = 0) => ({ exitCode, testsRun: 3, kind: exitCode ? 'assertion-failure' : 'passed', summary: 'fixed tests executed' });
function fixture(overrides = {}) {
  const calls = [], disposed = [], events = [];
  const options = {
    task: 'Implement task', snapshotTests: async () => 'frozen-hash',
    runAcceptance: async () => { events.push('acceptance'); return evidence(); },
    startChild: async (args) => {
      calls.push(args); events.push(`start:${args.role}:${args.round}`);
      const id = `${args.role}-${args.round}`;
      return { id, result: Promise.resolve({ stopReason: 'completed', structured: {
        status: args.role === 'implementation' ? 'ready' : 'pass', summary: `${args.role} evidence round ${args.round}`,
      } }), dispose: async () => { disposed.push(id); events.push(`dispose:${id}`); } };
    }, ...overrides,
  };
  return { calls, disposed, events, options, run: () => runRalph(options) };
}

test('implementation then distinct test child, disposal, and real acceptance precede complete', async () => {
  const f = fixture(); const result = await f.run();
  assert.equal(result.status, 'complete'); assert.equal(result.rounds.length, 1);
  assert.deepEqual(f.calls.map(c => c.role), ['implementation', 'test']);
  assert.deepEqual(f.disposed, ['implementation-1', 'test-1']);
  assert.deepEqual(f.events, ['start:implementation:1', 'dispose:implementation-1', 'start:test:1', 'dispose:test-1', 'acceptance']);
  assert.match(f.calls[1].feedback, /implementation evidence round 1/);
});

test('assertion failure hands previous implementation and failure evidence into next round', async () => {
  let executions = 0;
  const f = fixture({ runAcceptance: async () => ({ ...evidence(++executions === 1 ? 1 : 0), summary: 'assertion actual 2 expected 3' }) });
  const result = await f.run(); assert.equal(result.status, 'complete'); assert.equal(result.rounds.length, 2);
  assert.match(f.calls[2].feedback, /assertion actual 2 expected 3/);
  assert.match(f.calls[2].feedback, /implementation evidence round 1/);
  assert.match(f.calls[3].feedback, /implementation evidence round 2/);
});

test('test-child failure cannot be overruled by host pass', async () => {
  const f = fixture({ maxRounds: 2 }); const start = f.options.startChild;
  f.options.startChild = async a => { const h = await start(a); if (a.role === 'test') h.result = Promise.resolve({ stopReason: 'completed', structured: { status: 'fail', summary: 'independent failure' } }); return h; };
  const result = await f.run(); assert.equal(result.status, 'incomplete'); assert.equal(result.rounds.length, 2);
  assert.match(f.calls[2].feedback, /independent failure/);
});

test('default budget is exactly five failed rounds with fresh children', async () => {
  const f = fixture({ runAcceptance: async () => evidence(1) });
  const result = await f.run(); assert.equal(result.status, 'incomplete'); assert.equal(result.rounds.length, 5);
  assert.equal(new Set(f.disposed).size, 10); assert.equal(f.calls.length, 10);
});
for (const maxRounds of [0, 9, -1, 1.5]) test(`invalid round budget ${maxRounds} blocks before children`, async () => {
  const f = fixture({ maxRounds }); assert.equal((await f.run()).status, 'blocked'); assert.equal(f.calls.length, 0);
});
for (const acceptance of [undefined, {}, { ...evidence(), testsRun: 0 }, { ...evidence(), testsRun: -1 }, { ...evidence(), testsRun: '3' }, { ...evidence(), kind: 'infrastructure-error' }, { ...evidence(), kind: 'assertion-failure' }]) {
  test(`invalid or blocked host evidence cannot complete: ${JSON.stringify(acceptance)}`, async () => {
    const f = fixture({ runAcceptance: async () => acceptance });
    assert.equal((await f.run()).status, 'blocked'); assert.equal(f.calls.length, 2);
  });
}
for (const role of ['implementation', 'test']) {
  for (const structured of [undefined, {}, { status: 'pass', summary: '' }, { status: 'blocked', summary: 'environment unavailable' }, { status: 'ready', summary: 'ok', extra: true }]) {
    test(`${role} malformed or blocked report ${JSON.stringify(structured)} blocks and disposes`, async () => {
      const f = fixture(); const start = f.options.startChild;
      f.options.startChild = async a => { const h = await start(a); if (a.role === role) h.result = Promise.resolve({ stopReason: 'completed', structured }); return h; };
      assert.equal((await f.run()).status, 'blocked'); assert.equal(f.disposed.length, role === 'test' ? 2 : 1);
      assert.ok(!f.events.includes('acceptance'));
    });
  }
}
for (const failure of ['reject', 'abnormal', 'dispose', 'duplicate']) test(`child ${failure} blocks`, async () => {
  const f = fixture(); const start = f.options.startChild;
  f.options.startChild = async a => {
    const h = await start(a);
    if (failure === 'reject') h.result = Promise.reject(new Error('child crash'));
    if (failure === 'abnormal') h.result = Promise.resolve({ stopReason: 'error' });
    if (failure === 'dispose') h.dispose = async () => { throw new Error('dispose crash'); };
    if (failure === 'duplicate') h.id = 'same-id';
    return h;
  };
  assert.equal((await f.run()).status, 'blocked'); assert.ok(!f.events.includes('acceptance'));
});

test('cancellation reaches active child and disposal finishes before return', async () => {
  const controller = new AbortController(); let disposed = false;
  const f = fixture({ signal: controller.signal, startChild: async ({ signal }) => {
    assert.equal(signal, controller.signal);
    const result = new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    setImmediate(() => controller.abort(new Error('user cancelled')));
    return { id: 'active', result, dispose: async () => { disposed = true; } };
  } });
  assert.equal((await f.run()).status, 'cancelled'); assert.equal(disposed, true);
});

test('already cancelled run starts no children', async () => {
  const f = fixture({ signal: AbortSignal.abort() }); assert.equal((await f.run()).status, 'cancelled'); assert.equal(f.calls.length, 0);
});
for (const stage of ['implementation', 'test', 'acceptance', 'dispose']) test(`frozen manifest mutation during ${stage} blocks`, async () => {
  let hash = 'original'; const f = fixture({ snapshotTests: async () => hash }); const start = f.options.startChild;
  f.options.startChild = async a => { const h = await start(a); if (a.role === stage) hash = 'changed'; if (stage === 'dispose') h.dispose = async () => { hash = 'changed'; }; return h; };
  if (stage === 'acceptance') f.options.runAcceptance = async () => { hash = 'changed'; return evidence(); };
  const result = await f.run(); assert.equal(result.status, 'blocked'); assert.match(result.error, /Frozen/);
});

test('acceptance environment exception blocks without retry', async () => {
  const f = fixture({ runAcceptance: async () => { throw new Error('runner unavailable'); } });
  const result = await f.run(); assert.equal(result.status, 'blocked'); assert.equal(result.rounds.length, 1); assert.match(result.error, /runner unavailable/);
});
