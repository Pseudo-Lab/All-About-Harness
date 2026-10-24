import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';

const cli = process.env.TODO_CLI;
assert.ok(cli && isAbsolute(cli), 'TODO_CLI must name the ledger CLI');

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'ledger-acceptance-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'ledger.json');
  let serial = 0;
  function csv(content) {
    const path = join(dir, `input-${++serial}.csv`);
    writeFileSync(path, content);
    return path;
  }
  function run(args, store = file) {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd: dir, env: { ...process.env, LEDGER_FILE: store }, encoding: 'utf8', timeout: 5000,
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    return result;
  }
  function ok(args, store) {
    const result = run(args, store);
    assert.equal(result.status, 0, `${JSON.stringify(args)}: ${result.stderr}`);
    return JSON.parse(result.stdout);
  }
  function fail(args) {
    const before = existsSync(file) ? readFileSync(file) : null;
    const result = run(args);
    assert.notEqual(result.status, 0, `must reject ${JSON.stringify(args)}`);
    assert.deepEqual(existsSync(file) ? readFileSync(file) : null, before, 'rejected command changed store');
  }
  return { file, csv, ok, fail };
}

const header = 'id,date,amount,category\n';
const entry = (id, date, amount, category) => ({ id, date, amount, category });

test('empty reads do not create a store', t => {
  const { file, ok } = fixture(t);
  assert.deepEqual(ok(['ledger', 'list']), []);
  assert.deepEqual(ok(['ledger', 'summary']), { count: 0, total: 0, byCategory: {} });
  assert.equal(existsSync(file), false);
});

test('valid imports persist rows and cents in first-import order', t => {
  const { file, csv, ok } = fixture(t);
  const path = csv(header + 'A,2024-02-29,125,Food\nB,2024-03-01,-40,Refund\n');
  assert.deepEqual(ok(['ledger', 'import', path]), { added: 2, skipped: 0, total: 2 });
  assert.deepEqual(ok(['ledger', 'list']), [entry('A', '2024-02-29', 125, 'Food'), entry('B', '2024-03-01', -40, 'Refund')]);
  assert.doesNotThrow(() => JSON.parse(readFileSync(file, 'utf8')));
});

test('identical re-import is idempotent without changing store bytes', t => {
  const { file, csv, ok } = fixture(t);
  const path = csv(header + 'A,2024-01-01,5,One\n');
  ok(['ledger', 'import', path]);
  const before = readFileSync(file);
  assert.deepEqual(ok(['ledger', 'import', path]), { added: 0, skipped: 1, total: 1 });
  assert.deepEqual(readFileSync(file), before);
});

test('new rows and matching duplicate IDs can arrive in a later file', t => {
  const { csv, ok } = fixture(t);
  ok(['ledger', 'import', csv(header + 'A,2024-01-01,5,One\n')]);
  assert.deepEqual(ok(['ledger', 'import', csv(header + 'A,2024-01-01,5,One\nB,2024-01-02,7,Two\n')]),
    { added: 1, skipped: 1, total: 2 });
  assert.deepEqual(ok(['ledger', 'list']), [entry('A', '2024-01-01', 5, 'One'), entry('B', '2024-01-02', 7, 'Two')]);
});

test('conflicting duplicate aborts the entire import', t => {
  const { csv, ok, fail } = fixture(t);
  ok(['ledger', 'import', csv(header + 'A,2024-01-01,5,One\n')]);
  fail(['ledger', 'import', csv(header + 'B,2024-01-02,7,Two\nA,2024-01-01,6,One\n')]);
  assert.deepEqual(ok(['ledger', 'list']), [entry('A', '2024-01-01', 5, 'One')]);
});

test('invalid CSV records and dates reject atomically', t => {
  const { file, csv, fail } = fixture(t);
  for (const body of [
    'bad,date,amount,category\nA,2024-01-01,5,One\n',
    header + 'A,2024-02-30,5,One\n',
    header + 'A,2023-02-29,5,One\n',
    header + 'A,2024-01-01,1e0,One\n',
    header + 'A,2024-01-01,0,One\n',
    header + 'bad,2024-01-01,5,One\n',
    header + 'A,2024-01-01,5,   \n',
    header + 'A,2024-01-01,5,One\nB,2024-01-02,7\n',
    header + 'A,2024-01-01,5,"Unclosed\n',
  ]) fail(['ledger', 'import', csv(body)]);
  assert.equal(existsSync(file), false);
});

test('quoted commas and escaped quotes survive CSV parsing', t => {
  const { csv, ok } = fixture(t);
  const path = csv(header + 'A,2024-01-01,125,"Food, drink"\r\nB,2024-01-02,-25,"He said ""yes"""\r\n');
  assert.deepEqual(ok(['ledger', 'import', path]), { added: 2, skipped: 0, total: 2 });
  assert.deepEqual(ok(['ledger', 'list']), [
    entry('A', '2024-01-01', 125, 'Food, drink'), entry('B', '2024-01-02', -25, 'He said "yes"'),
  ]);
});

test('summaries aggregate signed cents over inclusive date ranges', t => {
  const { csv, ok, fail } = fixture(t);
  ok(['ledger', 'import', csv(header +
    'A,2024-01-01,100,Food\nB,2024-01-02,-20,Food\nC,2024-02-01,50,Travel\n')]);
  assert.deepEqual(ok(['ledger', 'summary']), { count: 3, total: 130, byCategory: { Food: 80, Travel: 50 } });
  assert.deepEqual(ok(['ledger', 'summary', '2024-01-02', '2024-02-01']),
    { count: 2, total: 30, byCategory: { Food: -20, Travel: 50 } });
  assert.deepEqual(ok(['ledger', 'summary', '2023-01-01', '2023-12-31']),
    { count: 0, total: 0, byCategory: {} });
  for (const args of [
    ['ledger', 'summary', '2024-01-01'], ['ledger', 'summary', '2024-02-01', '2024-01-01'],
    ['ledger', 'summary', '2024-02-30', '2024-03-01'],
  ]) fail(args);
});

test('delete returns the removed row and later deletion fails', t => {
  const { csv, ok, fail } = fixture(t);
  ok(['ledger', 'import', csv(header + 'A,2024-01-01,5,One\nB,2024-01-02,7,Two\n')]);
  assert.deepEqual(ok(['ledger', 'delete', 'A']), entry('A', '2024-01-01', 5, 'One'));
  fail(['ledger', 'delete', 'A']);
  assert.deepEqual(ok(['ledger', 'list']), [entry('B', '2024-01-02', 7, 'Two')]);
  assert.deepEqual(ok(['ledger', 'summary']), { count: 1, total: 7, byCategory: { Two: 7 } });
});

test('invalid commands and independent store paths preserve state', t => {
  const { file, csv, ok, fail } = fixture(t);
  for (const args of [[], ['unknown'], ['ledger'], ['ledger', 'import'],
    ['ledger', 'import', '/definitely/missing.csv'], ['ledger', 'delete', 'A']]) fail(args);
  assert.equal(existsSync(file), false);
  const path = csv(header + 'A,2024-01-01,5,One\n');
  ok(['ledger', 'import', path]);
  const other = `${file}.other`;
  assert.deepEqual(ok(['ledger', 'import', path], other), { added: 1, skipped: 0, total: 1 });
  ok(['ledger', 'delete', 'A']);
  assert.deepEqual(ok(['ledger', 'list']), []);
  assert.deepEqual(ok(['ledger', 'list'], other), [entry('A', '2024-01-01', 5, 'One')]);
  for (const args of [['ledger', 'list', 'extra'], ['ledger', 'import', path, 'extra'],
    ['ledger', 'summary', 'x', 'y', 'z'], ['ledger', 'delete', 'A']]) fail(args);
});
