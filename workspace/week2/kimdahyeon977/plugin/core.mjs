/** Harness-independent orchestration. Adapters must honor signal and dispose to quiescence.
 * startChild({ role, round, task, feedback, signal }) returns { id, result, dispose }.
 * result resolves { stopReason:'completed', structured:{ status, summary } }.
 * Implementation statuses: ready|blocked. Test statuses: pass|fail|blocked.
 * snapshotTests() returns a deterministic manifest hash. runAcceptance({signal})
 * returns { exitCode, testsRun, kind: passed|assertion-failure|infrastructure-error, summary }.
 */
export async function runRalph({ startChild, snapshotTests, runAcceptance, task,
  signal = new AbortController().signal, maxRounds = 5, record = async () => {} }) {
  const rounds = [];
  let baseline;
  const check = async () => {
    if (await snapshotTests() !== baseline) throw new Error('Frozen test manifest changed');
  };
  const cancelled = () => signal.throwIfAborted();
  try {
    if (!Number.isInteger(maxRounds) || maxRounds < 1 || maxRounds > 8) throw new Error('maxRounds must be 1..8');
    if (typeof task !== 'string' || !task.trim()) throw new Error('task is required');
    cancelled();
    baseline = await snapshotTests();
    if (typeof baseline !== 'string' || !baseline) throw new Error('Missing test manifest hash');
    const ids = new Set();
    let feedback = '';
    for (let round = 1; round <= maxRounds; round++) {
      const entry = { round, handoff: feedback };
      await record({ event: 'round/start', round, handoff: feedback });
      rounds.push(entry);
      for (const role of ['implementation', 'test']) {
        cancelled();
        await check();
        let run;
        let failure;
        try {
          run = await startChild({ role, round, task, feedback: role === 'test' ? JSON.stringify({ previous: feedback, implementation: entry.implementation }).slice(0, 16000) : feedback, signal });
          if (!run || typeof run.dispose !== 'function') throw new Error('Invalid child handle');
          if (typeof run.id !== 'string' || !run.id || ids.has(run.id)) throw new Error('Child context must be fresh');
          ids.add(run.id);
          cancelled();
          const result = await run.result;
          cancelled();
          if (result?.stopReason !== 'completed') throw new Error('Child did not complete normally');
          const value = result.structured;
          const allowed = role === 'implementation' ? ['ready', 'blocked'] : ['pass', 'fail', 'blocked'];
          if (!value || Object.keys(value).some(key => !['status', 'summary'].includes(key))
            || !allowed.includes(value.status) || typeof value.summary !== 'string' || !value.summary.trim()) {
            throw new Error('Invalid structured child result');
          }
          entry[role] = { id: run.id, status: value.status, summary: value.summary.slice(0, 4000) };
          if (value.status === 'blocked') throw new Error(`${role} reported blocked`);
        } catch (error) { failure = error; }
        finally {
          if (run && typeof run.dispose === 'function') {
            try { await run.dispose(); } catch (error) { failure = new AggregateError([failure, error].filter(Boolean), 'Child disposal failed'); }
          }
          try { await check(); } catch (error) { failure = error; }
        }
        if (failure) throw failure;
      }
      cancelled();
      await check();
      try { entry.acceptance = await runAcceptance({ signal }); }
      finally { await check(); }
      cancelled();
      if (!Number.isInteger(entry.acceptance?.exitCode) || entry.acceptance.exitCode < 0
        || !Number.isInteger(entry.acceptance.testsRun) || entry.acceptance.testsRun < 1
        || !['passed', 'assertion-failure', 'infrastructure-error'].includes(entry.acceptance.kind)
        || typeof entry.acceptance.summary !== 'string') throw new Error('Invalid acceptance execution evidence');
      if (entry.acceptance.kind === 'infrastructure-error') throw new Error('Acceptance infrastructure error');
      if ((entry.acceptance.kind === 'passed') !== (entry.acceptance.exitCode === 0)) throw new Error('Inconsistent acceptance evidence');
      await record({ event: 'round/end', round, test: entry.test, acceptance: entry.acceptance });
      if (entry.test.status === 'pass' && entry.acceptance.exitCode === 0) return { status: 'complete', rounds, manifestHash: baseline };
      feedback = JSON.stringify({ implementation: entry.implementation, test: entry.test, acceptance: { ...entry.acceptance, summary: entry.acceptance.summary.slice(-4000) } });
    }
    return { status: 'incomplete', rounds, manifestHash: baseline };
  } catch (error) {
    return { status: signal.aborted && !(error instanceof AggregateError) ? 'cancelled' : 'blocked',
      rounds, ...(baseline === undefined ? {} : { manifestHash: baseline }), error: error instanceof Error ? error.message : String(error) };
  }
}
