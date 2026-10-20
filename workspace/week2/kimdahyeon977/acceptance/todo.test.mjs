import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = process.env.TODO_CLI ?? fileURLToPath(new URL('../example/cli.mjs', import.meta.url));
assert.ok(isAbsolute(cli), 'TODO_CLI must be an absolute path');

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'todo-acceptance-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'todos.json');
  const run = (args, storage = file) => {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd: dir,
      env: { ...process.env, TODO_FILE: storage },
      encoding: 'utf8',
      timeout: 5000,
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null, 'CLI must exit normally');
    return result;
  };
  const ok = (args, storage) => {
    const result = run(args, storage);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const fail = (args) => {
    const result = run(args);
    assert.notEqual(result.status, 0, `must reject ${JSON.stringify(args)}`);
  };
  return { dir, file, run, ok, fail };
}

function todo(value) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  assert.ok(Number.isSafeInteger(value.id) && value.id > 0);
  assert.equal(typeof value.title, 'string');
  assert.equal(typeof value.completed, 'boolean');
  return { id: value.id, title: value.title, completed: value.completed };
}

test('new storage lists an empty JSON array', (t) => {
  const { ok } = fixture(t);
  assert.deepEqual(ok(['list']), []);
});

test('adds persist literal titles across processes with stable increasing IDs', (t) => {
  const { ok, file } = fixture(t);
  const first = todo(ok(['add', 'Buy milk "today" 🥛']));
  assert.deepEqual(first, { id: first.id, title: 'Buy milk "today" 🥛', completed: false });
  assert.doesNotThrow(() => JSON.parse(readFileSync(file, 'utf8')));
  const second = todo(ok(['add', 'Read book']));
  assert.deepEqual(second, { id: second.id, title: 'Read book', completed: false });
  assert.ok(second.id > first.id);
  assert.deepEqual(ok(['list']).map(todo), [first, second]);
});

test('completion persists, is repeatable, and preserves IDs and other todos', (t) => {
  const { ok } = fixture(t);
  const first = todo(ok(['add', 'First']));
  const second = todo(ok(['add', 'Second']));
  const completed = { ...first, completed: true };
  assert.deepEqual(todo(ok(['complete', String(first.id)])), completed);
  assert.deepEqual(todo(ok(['complete', String(first.id)])), completed);
  assert.deepEqual(ok(['list']).map(todo), [completed, second]);
  const third = todo(ok(['add', 'Third']));
  assert.ok(third.id > second.id);
  assert.deepEqual(ok(['list']).map(todo), [completed, second, third]);
});

const invalid = [
  ['add'], ['add', ''], ['add', ' \t\n '], ['add', 'one', 'two'],
  ['complete'], ...['', '0', '-1', '1.5', 'abc', '1x', '1e0', '9007199254740992'].map(id => ['complete', id]),
  ['complete', '1', 'extra'], ['list', 'extra'], ['unknown'], [],
];

test('invalid input never creates storage', (t) => {
  const { file, fail } = fixture(t);
  for (const args of [...invalid, ['complete', '999999']]) {
    fail(args);
    assert.equal(existsSync(file), false, JSON.stringify(args));
  }
});

test('invalid input preserves storage bytes, todos, and the next ID', (t) => {
  const { ok, fail, file, dir } = fixture(t);
  const first = todo(ok(['add', 'Keep me']));
  const control = join(dir, 'control.json');
  const controlFirst = todo(ok(['add', 'Keep me'], control));
  assert.equal(controlFirst.id, first.id);
  const before = readFileSync(file);
  for (const args of [...invalid, ['complete', String(first.id + 1)]]) {
    fail(args);
    assert.deepEqual(readFileSync(file), before, JSON.stringify(args));
    assert.deepEqual(ok(['list']).map(todo), [first]);
  }
  const next = todo(ok(['add', 'Next']));
  const controlNext = todo(ok(['add', 'Next'], control));
  assert.equal(next.id, controlNext.id, 'rejections must not consume IDs');
  assert.ok(next.id > first.id);
});

test('TODO_FILE isolates independent stores', (t) => {
  const { ok, dir } = fixture(t);
  const first = todo(ok(['add', 'Store A']));
  const other = join(dir, 'other.json');
  assert.deepEqual(ok(['list'], other), []);
  const second = todo(ok(['add', 'Store B'], other));
  assert.deepEqual(ok(['list']).map(todo), [first]);
  assert.deepEqual(ok(['list'], other).map(todo), [second]);
});
