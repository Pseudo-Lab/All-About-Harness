import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';

const cli = process.env.TODO_CLI;
assert.ok(cli && isAbsolute(cli), 'TODO_CLI must point to the order CLI');

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'orders-acceptance-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'orders.json');
  function run(args, options = {}) {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd: dir, env: { ...process.env, ORDER_FILE: options.file ?? file,
        ...(options.failpoint ? { ORDER_FAILPOINT: options.failpoint } : { ORDER_FAILPOINT: '' }) },
      encoding: 'utf8', timeout: 10000,
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    return result;
  }
  function ok(args, options) {
    const result = run(args, options);
    assert.equal(result.status, 0, `${JSON.stringify(args)}: ${result.stderr}`);
    return JSON.parse(result.stdout);
  }
  function fail(args, options) {
    const target = options?.file ?? file;
    const before = existsSync(target) ? readFileSync(target) : null;
    const result = run(args, options);
    assert.notEqual(result.status, 0, `must reject ${JSON.stringify(args)}`);
    assert.deepEqual(existsSync(target) ? readFileSync(target) : null, before, 'failed command changed store');
  }
  return { file, ok, fail, run };
}

const product = (sku, stock, reserved, price) => ({ sku, stock, reserved, price });
const order = (id, sku, qty, total, status, payment = null) => ({ id, sku, qty, total, status, payment });
const event = (seq, type, id) => ({ seq, type, id });

test('empty reads do not create a store', t => {
  const { file, ok } = fixture(t);
  assert.deepEqual(ok(['product', 'list']), []);
  assert.deepEqual(ok(['order', 'list']), []);
  assert.deepEqual(ok(['audit']), []);
  assert.equal(existsSync(file), false);
});

test('products persist in creation order and expose physical stock', t => {
  const { file, ok } = fixture(t);
  assert.deepEqual(ok(['product', 'add', 'RED', '5', '125']), product('RED', 5, 0, 125));
  assert.deepEqual(ok(['product', 'add', 'BLUE', '0', '250']), product('BLUE', 0, 0, 250));
  assert.deepEqual(ok(['product', 'list']), [product('RED', 5, 0, 125), product('BLUE', 0, 0, 250)]);
  const saved = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(saved.version, 1);
  assert.ok(Array.isArray(saved.events));
  assert.equal(saved.events.length, 2);
});

test('duplicate product and invalid product arguments are atomic errors', t => {
  const { ok, fail } = fixture(t);
  ok(['product', 'add', 'RED', '5', '125']);
  for (const args of [
    ['product', 'add', 'RED', '1', '1'], ['product', 'add', 'bad', '1', '1'],
    ['product', 'add', 'RED2', '-1', '1'], ['product', 'add', 'RED2', '01', '1'],
    ['product', 'add', 'RED2', '1e0', '1'], ['product', 'add', 'RED2', '1000001', '1'],
    ['product', 'add', 'RED2', '1', '0'], ['product', 'add', 'RED2', '1', '1000000001'],
    ['product', 'add', 'RED2', '1', '1', 'extra'],
  ]) fail(args);
});

test('orders reserve units without reducing physical stock', t => {
  const { ok } = fixture(t);
  ok(['product', 'add', 'RED', '5', '125']);
  assert.deepEqual(ok(['order', 'create', 'ONE', 'RED', '3']), order('ONE', 'RED', 3, 375, 'reserved'));
  assert.deepEqual(ok(['product', 'list']), [product('RED', 5, 3, 125)]);
  assert.deepEqual(ok(['order', 'get', 'ONE']), order('ONE', 'RED', 3, 375, 'reserved'));
  assert.deepEqual(ok(['order', 'list']), [order('ONE', 'RED', 3, 375, 'reserved')]);
});

test('availability accounts for all reservations and order IDs are unique', t => {
  const { ok, fail } = fixture(t);
  ok(['product', 'add', 'RED', '5', '125']);
  ok(['order', 'create', 'ONE', 'RED', '3']);
  fail(['order', 'create', 'TWO', 'RED', '3']);
  assert.deepEqual(ok(['order', 'create', 'TWO', 'RED', '2']), order('TWO', 'RED', 2, 250, 'reserved'));
  fail(['order', 'create', 'ONE', 'RED', '1']);
  assert.deepEqual(ok(['product', 'list']), [product('RED', 5, 5, 125)]);
});

test('unknown and malformed orders do not consume inventory', t => {
  const { ok, fail } = fixture(t);
  ok(['product', 'add', 'RED', '5', '125']);
  for (const args of [
    ['order', 'create', 'ONE', 'NOPE', '1'], ['order', 'create', 'bad', 'RED', '1'],
    ['order', 'create', 'ONE', 'RED', '0'], ['order', 'create', 'ONE', 'RED', '01'],
    ['order', 'create', 'ONE', 'RED', '1e0'], ['order', 'create', 'ONE', 'RED', '6'],
    ['order', 'get', 'NOPE'], ['order', 'get', 'ONE', 'extra'],
  ]) fail(args);
  assert.deepEqual(ok(['product', 'list']), [product('RED', 5, 0, 125)]);
});

test('declined payment remains reserved and retry may approve', t => {
  const { ok } = fixture(t);
  ok(['product', 'add', 'RED', '5', '125']);
  ok(['order', 'create', 'ONE', 'RED', '3']);
  assert.deepEqual(ok(['order', 'pay', 'ONE', 'KEY1', 'declined']),
    order('ONE', 'RED', 3, 375, 'reserved', { key: 'KEY1', status: 'declined' }));
  assert.deepEqual(ok(['product', 'list']), [product('RED', 5, 3, 125)]);
  assert.deepEqual(ok(['order', 'pay', 'ONE', 'KEY2', 'approved']),
    order('ONE', 'RED', 3, 375, 'paid', { key: 'KEY2', status: 'approved' }));
  assert.deepEqual(ok(['product', 'list']), [product('RED', 2, 0, 125)]);
});

test('payment retries return historical response without new events', t => {
  const { file, ok } = fixture(t);
  ok(['product', 'add', 'RED', '5', '125']);
  ok(['order', 'create', 'ONE', 'RED', '2']);
  const declined = ok(['order', 'pay', 'ONE', 'KEY1', 'declined']);
  const firstBytes = readFileSync(file);
  assert.deepEqual(ok(['order', 'pay', 'ONE', 'KEY1', 'declined']), declined);
  assert.deepEqual(readFileSync(file), firstBytes);
  ok(['order', 'pay', 'ONE', 'KEY2', 'approved']);
  const laterBytes = readFileSync(file);
  assert.deepEqual(ok(['order', 'pay', 'ONE', 'KEY1', 'declined']), declined);
  assert.deepEqual(readFileSync(file), laterBytes);
});

test('payment keys are global and cannot be repurposed', t => {
  const { ok, fail } = fixture(t);
  ok(['product', 'add', 'RED', '5', '125']);
  ok(['order', 'create', 'ONE', 'RED', '1']);
  ok(['order', 'create', 'TWO', 'RED', '1']);
  ok(['order', 'pay', 'ONE', 'KEY1', 'declined']);
  fail(['order', 'pay', 'ONE', 'KEY1', 'approved']);
  fail(['order', 'pay', 'TWO', 'KEY1', 'declined']);
  fail(['order', 'pay', 'ONE', 'bad', 'approved']);
  fail(['order', 'pay', 'ONE', 'KEY2', 'maybe']);
});

test('approval consumes stock once and disallows a new charge', t => {
  const { file, ok, fail } = fixture(t);
  ok(['product', 'add', 'RED', '5', '125']);
  ok(['order', 'create', 'ONE', 'RED', '3']);
  const paid = ok(['order', 'pay', 'ONE', 'KEY1', 'approved']);
  const before = readFileSync(file);
  assert.deepEqual(ok(['order', 'pay', 'ONE', 'KEY1', 'approved']), paid);
  assert.deepEqual(readFileSync(file), before);
  fail(['order', 'pay', 'ONE', 'KEY2', 'approved']);
  assert.deepEqual(ok(['product', 'list']), [product('RED', 2, 0, 125)]);
});

test('cancel reserved order releases only its reservation', t => {
  const { file, ok } = fixture(t);
  ok(['product', 'add', 'RED', '5', '125']);
  ok(['order', 'create', 'ONE', 'RED', '3']);
  const cancelled = order('ONE', 'RED', 3, 375, 'cancelled');
  assert.deepEqual(ok(['order', 'cancel', 'ONE']), cancelled);
  const before = readFileSync(file);
  assert.deepEqual(ok(['order', 'cancel', 'ONE']), cancelled);
  assert.deepEqual(readFileSync(file), before);
  assert.deepEqual(ok(['product', 'list']), [product('RED', 5, 0, 125)]);
  assert.deepEqual(ok(['order', 'create', 'TWO', 'RED', '5']), order('TWO', 'RED', 5, 625, 'reserved'));
});

test('cancel paid order refunds stock and preserves approved payment', t => {
  const { ok, fail } = fixture(t);
  ok(['product', 'add', 'RED', '5', '125']);
  ok(['order', 'create', 'ONE', 'RED', '3']);
  ok(['order', 'pay', 'ONE', 'KEY1', 'approved']);
  assert.deepEqual(ok(['order', 'cancel', 'ONE']),
    order('ONE', 'RED', 3, 375, 'refunded', { key: 'KEY1', status: 'approved' }));
  assert.deepEqual(ok(['product', 'list']), [product('RED', 5, 0, 125)]);
  fail(['order', 'pay', 'ONE', 'KEY2', 'approved']);
});

test('cancelled orders reject payment but original attempt replay survives', t => {
  const { ok, fail } = fixture(t);
  ok(['product', 'add', 'RED', '5', '125']);
  ok(['order', 'create', 'ONE', 'RED', '1']);
  const declined = ok(['order', 'pay', 'ONE', 'KEY1', 'declined']);
  ok(['order', 'cancel', 'ONE']);
  assert.deepEqual(ok(['order', 'pay', 'ONE', 'KEY1', 'declined']), declined);
  fail(['order', 'pay', 'ONE', 'KEY2', 'approved']);
});

test('audit has one event per committed change in sequence', t => {
  const { ok } = fixture(t);
  ok(['product', 'add', 'RED', '5', '125']);
  ok(['order', 'create', 'ONE', 'RED', '2']);
  ok(['order', 'pay', 'ONE', 'KEY1', 'declined']);
  ok(['order', 'pay', 'ONE', 'KEY1', 'declined']);
  ok(['order', 'pay', 'ONE', 'KEY2', 'approved']);
  ok(['order', 'cancel', 'ONE']);
  ok(['order', 'cancel', 'ONE']);
  assert.deepEqual(ok(['audit']), [
    event(1, 'product.add', 'RED'), event(2, 'order.create', 'ONE'),
    event(3, 'payment.declined', 'ONE'), event(4, 'payment.approved', 'ONE'),
    event(5, 'payment.refunded', 'ONE'),
  ]);
});

test('failpoint leaves no event and retry works after restart', t => {
  const { file, ok, fail } = fixture(t);
  fail(['product', 'add', 'RED', '5', '125'], { failpoint: 'before_commit' });
  assert.equal(existsSync(file), false);
  ok(['product', 'add', 'RED', '5', '125']);
  fail(['order', 'create', 'ONE', 'RED', '2'], { failpoint: 'before_commit' });
  assert.deepEqual(ok(['order', 'list']), []);
  ok(['order', 'create', 'ONE', 'RED', '2']);
  fail(['order', 'pay', 'ONE', 'KEY1', 'approved'], { failpoint: 'before_commit' });
  assert.deepEqual(ok(['order', 'get', 'ONE']), order('ONE', 'RED', 2, 250, 'reserved'));
  ok(['order', 'pay', 'ONE', 'KEY1', 'approved']);
  fail(['order', 'cancel', 'ONE'], { failpoint: 'before_commit' });
  assert.deepEqual(ok(['product', 'list']), [product('RED', 3, 0, 125)]);
});

test('idempotent no-op and reads still work under failpoint', t => {
  const { file, ok } = fixture(t);
  ok(['product', 'add', 'RED', '5', '125']);
  ok(['order', 'create', 'ONE', 'RED', '1']);
  const paid = ok(['order', 'pay', 'ONE', 'KEY1', 'approved']);
  const bytes = readFileSync(file);
  assert.deepEqual(ok(['order', 'pay', 'ONE', 'KEY1', 'approved'], { failpoint: 'before_commit' }), paid);
  assert.deepEqual(ok(['order', 'get', 'ONE'], { failpoint: 'before_commit' }), paid);
  assert.deepEqual(readFileSync(file), bytes);
});

test('corrupted store is rejected without being overwritten', t => {
  const { file, fail } = fixture(t);
  writeFileSync(file, '{broken-json');
  fail(['product', 'list']);
  fail(['product', 'add', 'RED', '1', '1']);
  writeFileSync(file, JSON.stringify({ version: 1, events: [{ seq: 2, type: 'product.add', id: 'RED' }] }));
  fail(['audit']);
});

test('invalid command forms and independent stores preserve bytes', t => {
  const { file, ok, fail } = fixture(t);
  for (const args of [[], ['product'], ['order'], ['audit', 'extra'], ['unknown']]) fail(args);
  ok(['product', 'add', 'RED', '1', '1']);
  const other = `${file}.other`;
  assert.deepEqual(ok(['product', 'list'], { file: other }), []);
  assert.deepEqual(ok(['product', 'add', 'BLUE', '2', '2'], { file: other }), product('BLUE', 2, 0, 2));
  assert.deepEqual(ok(['product', 'list']), [product('RED', 1, 0, 1)]);
  for (const args of [
    ['product', 'list', 'extra'], ['order', 'list', 'extra'], ['order', 'cancel', 'NOPE'],
    ['order', 'pay', 'NOPE', 'KEY1', 'approved'], ['order', 'create', 'ONE', 'RED'],
  ]) fail(args);
});
