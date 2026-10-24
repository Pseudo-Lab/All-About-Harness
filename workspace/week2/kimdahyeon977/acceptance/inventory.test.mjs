import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';

const cli = process.env.TODO_CLI;
assert.ok(cli && isAbsolute(cli), 'TODO_CLI must name the inventory CLI');

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'inventory-acceptance-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'inventory.json');
  function run(args, store = file) {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd: dir, env: { ...process.env, INVENTORY_FILE: store }, encoding: 'utf8', timeout: 5000,
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
  return { file, dir, ok, fail };
}

const row = (sku, name, onHand = 0, reserved = 0) => ({ sku, name, onHand, reserved });

test('empty reads do not create a store', t => {
  const { file, ok } = fixture(t);
  assert.deepEqual(ok(['item', 'list']), []);
  assert.deepEqual(ok(['stock', 'report']), { items: [], totalOnHand: 0, totalReserved: 0, totalAvailable: 0 });
  assert.equal(existsSync(file), false);
});

test('items persist in insertion order and retain literal names', t => {
  const { file, ok, fail } = fixture(t);
  assert.deepEqual(ok(['item', 'add', 'CPU-1', '  Processor  ']), row('CPU-1', '  Processor  '));
  assert.deepEqual(ok(['item', 'add', 'RAM2', 'Memory']), row('RAM2', 'Memory'));
  fail(['item', 'add', 'CPU-1', 'Duplicate']);
  assert.deepEqual(ok(['item', 'list']), [row('CPU-1', '  Processor  '), row('RAM2', 'Memory')]);
  assert.doesNotThrow(() => JSON.parse(readFileSync(file, 'utf8')));
});

test('receipts increase stock and persist across processes', t => {
  const { ok } = fixture(t);
  ok(['item', 'add', 'A', 'Part']);
  assert.deepEqual(ok(['stock', 'receive', 'A', '7']), row('A', 'Part', 7, 0));
  assert.deepEqual(ok(['stock', 'receive', 'A', '5']), row('A', 'Part', 12, 0));
  assert.deepEqual(ok(['item', 'list']), [row('A', 'Part', 12, 0)]);
});

test('reservations use only available stock', t => {
  const { ok, fail } = fixture(t);
  ok(['item', 'add', 'A', 'Part']);
  ok(['stock', 'receive', 'A', '5']);
  assert.deepEqual(ok(['stock', 'reserve', 'A', '3']), row('A', 'Part', 5, 3));
  fail(['stock', 'reserve', 'A', '3']);
  assert.deepEqual(ok(['stock', 'reserve', 'A', '2']), row('A', 'Part', 5, 5));
});

test('release restores availability without changing on-hand stock', t => {
  const { ok, fail } = fixture(t);
  ok(['item', 'add', 'A', 'Part']);
  ok(['stock', 'receive', 'A', '5']);
  ok(['stock', 'reserve', 'A', '4']);
  assert.deepEqual(ok(['stock', 'release', 'A', '2']), row('A', 'Part', 5, 2));
  fail(['stock', 'release', 'A', '3']);
  assert.deepEqual(ok(['stock', 'reserve', 'A', '3']), row('A', 'Part', 5, 5));
});

test('shipment consumes reserved and on-hand stock together', t => {
  const { ok, fail } = fixture(t);
  ok(['item', 'add', 'A', 'Part']);
  ok(['stock', 'receive', 'A', '8']);
  fail(['stock', 'ship', 'A', '1']);
  ok(['stock', 'reserve', 'A', '5']);
  assert.deepEqual(ok(['stock', 'ship', 'A', '3']), row('A', 'Part', 5, 2));
  fail(['stock', 'ship', 'A', '3']);
  assert.deepEqual(ok(['stock', 'ship', 'A', '2']), row('A', 'Part', 3, 0));
});

test('report aggregates on-hand, reserved, and available counts', t => {
  const { ok } = fixture(t);
  ok(['item', 'add', 'A', 'Alpha']);
  ok(['item', 'add', 'B', 'Beta']);
  ok(['stock', 'receive', 'A', '10']);
  ok(['stock', 'receive', 'B', '4']);
  ok(['stock', 'reserve', 'A', '6']);
  ok(['stock', 'reserve', 'B', '1']);
  assert.deepEqual(ok(['stock', 'report']), {
    items: [row('A', 'Alpha', 10, 6), row('B', 'Beta', 4, 1)],
    totalOnHand: 14, totalReserved: 7, totalAvailable: 7,
  });
});

test('invalid quantities and overflow preserve persisted bytes', t => {
  const { ok, fail } = fixture(t);
  ok(['item', 'add', 'A', 'Part']);
  for (const q of ['0', '-1', '01', '1.5', '1e0', 'x', '9007199254740992']) fail(['stock', 'receive', 'A', q]);
  ok(['stock', 'receive', 'A', String(Number.MAX_SAFE_INTEGER)]);
  fail(['stock', 'receive', 'A', '1']);
  assert.deepEqual(ok(['item', 'list']), [row('A', 'Part', Number.MAX_SAFE_INTEGER, 0)]);
});

test('invalid shapes, identifiers, and missing items preserve storage', t => {
  const { file, ok, fail } = fixture(t);
  for (const args of [[], ['wat'], ['item', 'add'], ['item', 'add', 'bad', 'Part'],
    ['item', 'add', 'A', '  '], ['stock', 'receive', 'A', '1']]) fail(args);
  assert.equal(existsSync(file), false);
  ok(['item', 'add', 'A', 'Part']);
  for (const args of [['item', 'list', 'extra'], ['item', 'add', 'B', 'Part', 'extra'],
    ['stock', 'receive', 'B', '1'], ['stock', 'reserve', 'B', '1'],
    ['stock', 'release', 'A', '1'], ['stock', 'ship', 'A', '1'],
    ['stock', 'report', 'extra']]) fail(args);
});

test('separate store paths remain isolated', t => {
  const { file, ok } = fixture(t);
  const other = `${file}.other`;
  ok(['item', 'add', 'A', 'First']);
  ok(['item', 'add', 'B', 'Second'], other);
  assert.deepEqual(ok(['item', 'list']), [row('A', 'First')]);
  assert.deepEqual(ok(['item', 'list'], other), [row('B', 'Second')]);
});
