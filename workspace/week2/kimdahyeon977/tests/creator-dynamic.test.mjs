import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildCreatorSource } from '../runner/creator-source.mjs';

const evidence = (failed = false) => ({
  exitCode: failed ? 1 : 0, testsRun: 12,
  kind: failed ? 'assertion-failure' : 'passed',
  summary: failed ? 'complete ID: ERR_ASSERTION expected completed:true; unsupported command' : 'full frozen suite passed',
});

// Evaluate the actual generated artifact. The VM deliberately has no imports,
// process, or AbortController; the low-level host supplies an existing signal.
async function fixture(overrides = {}) {
  const calls = [], disposed = [], events = [], registrations = [], hostCalls = [];
  const signal = new AbortController().signal;
  const objective = 'Planned staged TODO: round 1 add/list; round 2 implement complete from failure feedback';
  const exec = { signal, agent: { id: 'creator-parent' } };
  const runtime = {
    task: objective, signal, maxRounds: 5,
    snapshotTests: async () => 'frozen-manifest',
    runAcceptance: async () => { events.push('acceptance'); return evidence(); },
    startChild: async args => {
      calls.push(args);
      const id = `${args.role}-${args.round}`;
      events.push(`start:${id}`);
      return {
        id,
        result: Promise.resolve({ stopReason: 'completed', structured: {
          status: args.role === 'implementation' ? 'ready' : args.round === 1 ? 'fail' : 'pass',
          summary: args.role === 'implementation'
            ? args.round === 1 ? 'planned add/list only; complete explicitly unsupported' : 'implemented complete using prior failure'
            : args.round === 1 ? 'full unchanged suite: completion assertion failed' : 'full unchanged suite passed',
        } }),
        dispose: async () => { disposed.push(id); events.push(`dispose:${id}`); },
      };
    },
    ...overrides,
  };
  const forbidden = () => { throw new Error('Static tool dispatch is forbidden'); };
  const ctx = {
    ralphHost: { async withRun(task, execution, callback) {
      hostCalls.push({ task, execution });
      assert.equal(task, objective);
      assert.equal(execution, exec);
      assert.equal(typeof callback, 'function');
      return callback(runtime);
    } },
    experimentLoop: { run: forbidden },
    tools: { execute: forbidden, call: forbidden, get: forbidden },
  };
  const harness = {
    defineTool: definition => definition,
    registerTool(context, definition) {
      assert.equal(context, ctx);
      registrations.push(definition);
    },
  };
  const source = await buildCreatorSource('custom');
  assert.equal(typeof source, 'string');
  assert.ok(!source.includes('/*__RALPH_CORE__*/'), 'core placeholder must be expanded');
  assert.doesNotMatch(source, /\bname\s*:\s*['"](?:custom_ralph|ralph)['"]/, 'only the Creator entry tool may be registered');
  const sandbox = vm.createContext({ harness });
  assert.equal(vm.runInContext('typeof AbortController', sandbox), 'undefined');
  const plugin = new vm.Script(`(function () {\n${source}\n})()`, { filename: 'generated-creator-custom.js' }).runInContext(sandbox);
  await plugin.apply(ctx);
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].name, 'creator_run_loop');
  return { runtime, calls, disposed, events, hostCalls,
    run: () => registrations[0].execute({ objective }, exec) };
}

test('generated custom Creator executes failure, handoff, and successful second round in the VM', async () => {
  let acceptanceRuns = 0;
  const f = await fixture({ runAcceptance: async () => evidence(++acceptanceRuns === 1) });
  const result = await f.run();
  assert.equal(result.status, 'complete');
  assert.equal(result.manifestHash, 'frozen-manifest');
  assert.equal(result.rounds.length, 2);
  assert.equal(result.rounds[0].test.status, 'fail');
  assert.equal(result.rounds[0].acceptance.exitCode, 1);
  assert.equal(result.rounds[1].test.status, 'pass');
  assert.equal(result.rounds[1].acceptance.exitCode, 0);
  assert.equal(acceptanceRuns, 2);
  assert.equal(f.hostCalls.length, 1);
  assert.deepEqual(f.calls.map(({ role, round }) => [role, round]), [
    ['implementation', 1], ['test', 1], ['implementation', 2], ['test', 2],
  ]);
  assert.equal(f.calls[0].feedback, '');
  const handoff = JSON.parse(f.calls[2].feedback);
  assert.match(handoff.implementation.summary, /planned add\/list only/);
  assert.equal(handoff.test.status, 'fail');
  assert.match(handoff.test.summary, /completion assertion failed/);
  assert.equal(handoff.acceptance.exitCode, 1);
  assert.match(handoff.acceptance.summary, /ERR_ASSERTION/);
  assert.match(f.calls[3].feedback, /implemented complete using prior failure/);
  for (const call of f.calls) {
    assert.equal(call.signal, f.runtime.signal);
    assert.equal(call.task, f.runtime.task);
  }
  assert.deepEqual(f.disposed, ['implementation-1', 'test-1', 'implementation-2', 'test-2']);
});

test('generated custom Creator stops after five failed rounds with fresh disposed children', async () => {
  let acceptanceRuns = 0;
  const f = await fixture({ runAcceptance: async () => { acceptanceRuns++; return evidence(true); } });
  const result = await f.run();
  assert.equal(result.status, 'incomplete');
  assert.equal(result.rounds.length, 5);
  assert.equal(acceptanceRuns, 5);
  assert.equal(f.calls.length, 10);
  assert.equal(new Set(f.disposed).size, 10);
  assert.deepEqual(f.disposed, f.calls.map(({ role, round }) => `${role}-${round}`));
  assert.ok(f.calls.every(({ round }) => round <= 5));
});

for (const maxRounds of [0, 9]) test(`generated custom Creator blocks invalid maximum ${maxRounds}`, async () => {
  const f = await fixture({ maxRounds });
  const result = await f.run();
  assert.equal(result.status, 'blocked');
  assert.match(result.error, /maxRounds/);
  assert.equal(f.calls.length, 0);
});

test('generated custom Creator blocks host acceptance errors after disposing both children', async () => {
  const f = await fixture({ runAcceptance: async () => { throw new Error('acceptance runner unavailable'); } });
  const result = await f.run();
  assert.equal(result.status, 'blocked');
  assert.match(result.error, /acceptance runner unavailable/);
  assert.equal(result.rounds.length, 1);
  assert.deepEqual(f.disposed, ['implementation-1', 'test-1']);
});

test('generated custom Creator disposes a failed child and never runs acceptance', async () => {
  let disposed = false, acceptanceRuns = 0;
  const f = await fixture({
    startChild: async () => ({ id: 'crashed-child',
      result: Promise.resolve({ stopReason: 'error' }),
      dispose: async () => { disposed = true; },
    }),
    runAcceptance: async () => { acceptanceRuns++; return evidence(); },
  });
  const result = await f.run();
  assert.equal(result.status, 'blocked');
  assert.match(result.error, /did not complete normally/);
  assert.equal(disposed, true);
  assert.equal(acceptanceRuns, 0);
});

test('generated custom Creator blocks frozen-suite mutation', async () => {
  let snapshots = 0;
  const f = await fixture({ snapshotTests: async () => ++snapshots === 1 ? 'original' : 'changed' });
  const result = await f.run();
  assert.equal(result.status, 'blocked');
  assert.match(result.error, /Frozen test manifest changed/);
  assert.equal(f.calls.length, 0);
});

test('generated custom Creator honors a provided aborted signal without a VM AbortController', async () => {
  const f = await fixture({ signal: AbortSignal.abort(new Error('caller cancelled')) });
  const result = await f.run();
  assert.equal(result.status, 'cancelled');
  assert.equal(f.calls.length, 0);
});
