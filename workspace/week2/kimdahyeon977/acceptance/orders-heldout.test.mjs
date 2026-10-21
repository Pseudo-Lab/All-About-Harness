import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';

const cli = process.env.TODO_CLI;
assert.ok(cli && isAbsolute(cli));
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'orders-heldout-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'state.json');
  function run(args, failpoint = '') {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd: dir, env: { ...process.env, ORDER_FILE: file, ORDER_FAILPOINT: failpoint },
      encoding: 'utf8', timeout: 10000,
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    return result;
  }
  function ok(args, failpoint = '') {
    const result = run(args, failpoint);
    assert.equal(result.status, 0, `${args.join(' ')}: ${result.stderr}`);
    return JSON.parse(result.stdout);
  }
  function fail(args, failpoint = '') {
    const before = readFileSync(file);
    assert.notEqual(run(args, failpoint).status, 0);
    assert.deepEqual(readFileSync(file), before);
  }
  return { file, ok, fail };
}

test('mixed orders keep physical stock and reservations consistent across processes', t => {
  const { ok } = fixture(t);
  ok(['product', 'add', 'PART', '7', '13']);
  ok(['product', 'add', 'OTHER', '4', '8']);
  ok(['order', 'create', 'A', 'PART', '2']);
  ok(['order', 'create', 'B', 'PART', '3']);
  ok(['order', 'create', 'C', 'OTHER', '4']);
  ok(['order', 'pay', 'A', 'PAY-A', 'approved']);
  ok(['order', 'cancel', 'B']);
  assert.deepEqual(ok(['product', 'list']), [
    { sku: 'PART', stock: 5, reserved: 0, price: 13 },
    { sku: 'OTHER', stock: 4, reserved: 4, price: 8 },
  ]);
  assert.deepEqual(ok(['order', 'list']).map(item => item.status), ['paid', 'cancelled', 'reserved']);
});

test('refunded orders restore capacity once while historical charge result stays stable', t => {
  const { file, ok } = fixture(t);
  ok(['product', 'add', 'PART', '2', '9']);
  ok(['order', 'create', 'A', 'PART', '2']);
  const paid = ok(['order', 'pay', 'A', 'PAY-A', 'approved']);
  const refunded = ok(['order', 'cancel', 'A']);
  const afterRefund = readFileSync(file);
  assert.deepEqual(ok(['order', 'cancel', 'A']), refunded);
  assert.deepEqual(ok(['order', 'pay', 'A', 'PAY-A', 'approved']), paid);
  assert.deepEqual(readFileSync(file), afterRefund);
  assert.deepEqual(ok(['order', 'create', 'B', 'PART', '2']).status, 'reserved');
});

test('multiple declined keys preserve each original response after approval', t => {
  const { file, ok } = fixture(t);
  ok(['product', 'add', 'PART', '3', '11']);
  ok(['order', 'create', 'A', 'PART', '1']);
  const first = ok(['order', 'pay', 'A', 'DECLINE-1', 'declined']);
  const second = ok(['order', 'pay', 'A', 'DECLINE-2', 'declined']);
  const paid = ok(['order', 'pay', 'A', 'APPROVE-1', 'approved']);
  const bytes = readFileSync(file);
  assert.deepEqual(ok(['order', 'pay', 'A', 'DECLINE-1', 'declined']), first);
  assert.deepEqual(ok(['order', 'pay', 'A', 'DECLINE-2', 'declined']), second);
  assert.deepEqual(ok(['order', 'pay', 'A', 'APPROVE-1', 'approved']), paid);
  assert.deepEqual(readFileSync(file), bytes);
  assert.equal(ok(['audit']).length, 5);
});

test('a failed decline or refund can be retried exactly once', t => {
  const { file, ok, fail } = fixture(t);
  ok(['product', 'add', 'PART', '2', '10']);
  ok(['order', 'create', 'A', 'PART', '1']);
  fail(['order', 'pay', 'A', 'DECLINE-1', 'declined'], 'before_commit');
  assert.equal(ok(['order', 'get', 'A']).payment, null);
  ok(['order', 'pay', 'A', 'DECLINE-1', 'declined']);
  ok(['order', 'pay', 'A', 'APPROVE-1', 'approved']);
  fail(['order', 'cancel', 'A'], 'before_commit');
  assert.equal(ok(['order', 'get', 'A']).status, 'paid');
  ok(['order', 'cancel', 'A']);
  const bytes = readFileSync(file);
  ok(['order', 'cancel', 'A'], 'before_commit');
  assert.deepEqual(readFileSync(file), bytes);
});

test('global key conflicts remain rejected after the first order is refunded', t => {
  const { ok, fail } = fixture(t);
  ok(['product', 'add', 'PART', '2', '10']);
  ok(['order', 'create', 'A', 'PART', '1']);
  ok(['order', 'pay', 'A', 'PAY-A', 'approved']);
  ok(['order', 'cancel', 'A']);
  ok(['order', 'create', 'B', 'PART', '1']);
  fail(['order', 'pay', 'B', 'PAY-A', 'approved']);
  assert.equal(ok(['order', 'get', 'B']).status, 'reserved');
});
