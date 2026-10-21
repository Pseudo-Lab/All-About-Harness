import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';

const cli = process.env.TODO_CLI;
assert.ok(cli && isAbsolute(cli), 'TODO_CLI must name the absolute path to the planner CLI');

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'planner-acceptance-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'planner.json');
  const run = (args, storage = file) => {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd: dir, env: { ...process.env, PLAN_FILE: storage }, encoding: 'utf8', timeout: 5000,
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null, 'CLI must exit normally');
    return result;
  };
  const ok = (args, storage) => {
    const result = run(args, storage);
    assert.equal(result.status, 0, `${args.join(' ')}: ${result.stderr}`);
    return JSON.parse(result.stdout);
  };
  const fail = (args) => {
    const before = existsSync(file) ? readFileSync(file) : null;
    const result = run(args);
    assert.notEqual(result.status, 0, `must reject ${JSON.stringify(args)}`);
    assert.deepEqual(existsSync(file) ? readFileSync(file) : null, before, 'rejected command changed storage');
  };
  return { file, ok, fail, run };
}

function project(value) {
  assert.ok(Number.isSafeInteger(value?.id) && value.id > 0);
  assert.equal(typeof value.name, 'string');
  return { id: value.id, name: value.name };
}

function taskRow(value) {
  assert.ok(Number.isSafeInteger(value?.id) && value.id > 0);
  assert.ok(Number.isSafeInteger(value.projectId) && value.projectId > 0);
  assert.equal(typeof value.title, 'string');
  assert.ok(['open', 'done'].includes(value.status));
  assert.ok(Array.isArray(value.dependsOn));
  assert.ok(value.dependsOn.every(id => Number.isSafeInteger(id) && id > 0));
  return { id: value.id, projectId: value.projectId, title: value.title,
    status: value.status, dependsOn: value.dependsOn };
}

test('empty store lists no projects without creating a file', (t) => {
  const { file, ok } = fixture(t);
  assert.deepEqual(ok(['project', 'list']), []);
  assert.equal(existsSync(file), false);
});

test('projects persist literal names and increasing IDs across processes', (t) => {
  const { file, ok } = fixture(t);
  const a = project(ok(['project', 'add', 'Launch 🚀']));
  const b = project(ok(['project', 'add', 'Docs']));
  assert.equal(a.name, 'Launch 🚀');
  assert.equal(b.name, 'Docs');
  assert.ok(b.id > a.id);
  assert.deepEqual(ok(['project', 'list']).map(project), [a, b]);
  assert.doesNotThrow(() => JSON.parse(readFileSync(file, 'utf8')));
});

test('tasks persist in creation order and are scoped to their project', (t) => {
  const { ok } = fixture(t);
  const a = project(ok(['project', 'add', 'A']));
  const b = project(ok(['project', 'add', 'B']));
  const first = taskRow(ok(['task', 'add', String(a.id), 'API schema']));
  const second = taskRow(ok(['task', 'add', String(a.id), 'UI']));
  const other = taskRow(ok(['task', 'add', String(b.id), 'Deploy']));
  assert.deepEqual(first, { id: first.id, projectId: a.id, title: 'API schema', status: 'open', dependsOn: [] });
  assert.ok(second.id > first.id && other.id > second.id);
  assert.deepEqual(ok(['task', 'list', String(a.id)]).map(taskRow), [first, second]);
  assert.deepEqual(ok(['task', 'list', String(b.id)]).map(taskRow), [other]);
});

test('invalid creation and command shapes never create or alter storage', (t) => {
  const { file, ok, fail } = fixture(t);
  for (const args of [[], ['unknown'], ['project', 'add'], ['project', 'add', '  '],
    ['project', 'add', 'x', 'extra'], ['task', 'add', '1', 'orphan']]) fail(args);
  assert.equal(existsSync(file), false);
  const p = project(ok(['project', 'add', 'Valid']));
  for (const args of [['project', 'list', 'extra'], ['task', 'add', String(p.id), '  '],
    ['task', 'add', '0', 'bad'], ['task', 'add', '1.5', 'bad'],
    ['task', 'add', String(p.id), 'x', 'extra'], ['task', 'list', '999999']]) fail(args);
  assert.deepEqual(ok(['project', 'list']).map(project), [p]);
});

test('dependencies block ready work until prerequisites are done', (t) => {
  const { ok } = fixture(t);
  const p = project(ok(['project', 'add', 'Release']));
  const design = taskRow(ok(['task', 'add', String(p.id), 'Design']));
  const build = taskRow(ok(['task', 'add', String(p.id), 'Build']));
  const updated = taskRow(ok(['task', 'depend', String(build.id), String(design.id)]));
  assert.deepEqual(updated.dependsOn, [design.id]);
  assert.deepEqual(ok(['task', 'ready', String(p.id)]).map(taskRow), [design]);
  assert.deepEqual(ok(['task', 'list', String(p.id)]).map(taskRow), [design, updated]);
});

test('dependency validation rejects duplicates, self links, cross-project links and cycles', (t) => {
  const { ok, fail } = fixture(t);
  const p = project(ok(['project', 'add', 'Main']));
  const q = project(ok(['project', 'add', 'Other']));
  const a = taskRow(ok(['task', 'add', String(p.id), 'A']));
  const b = taskRow(ok(['task', 'add', String(p.id), 'B']));
  const c = taskRow(ok(['task', 'add', String(p.id), 'C']));
  const other = taskRow(ok(['task', 'add', String(q.id), 'Other']));
  ok(['task', 'depend', String(a.id), String(b.id)]);
  ok(['task', 'depend', String(b.id), String(c.id)]);
  for (const args of [
    ['task', 'depend', String(a.id), String(b.id)],
    ['task', 'depend', String(a.id), String(a.id)],
    ['task', 'depend', String(c.id), String(a.id)],
    ['task', 'depend', String(a.id), String(other.id)],
    ['task', 'depend', String(a.id), '0'],
  ]) fail(args);
  assert.deepEqual(taskRow(ok(['task', 'list', String(p.id)])[2]).dependsOn, []);
});

test('ready lists only open tasks whose entire dependency set is done', (t) => {
  const { ok } = fixture(t);
  const p = project(ok(['project', 'add', 'Pipeline']));
  const a = taskRow(ok(['task', 'add', String(p.id), 'A']));
  const b = taskRow(ok(['task', 'add', String(p.id), 'B']));
  const c = taskRow(ok(['task', 'add', String(p.id), 'C']));
  ok(['task', 'depend', String(c.id), String(a.id)]);
  ok(['task', 'depend', String(c.id), String(b.id)]);
  assert.deepEqual(ok(['task', 'ready', String(p.id)]).map(x => x.id), [a.id, b.id]);
  ok(['task', 'complete', String(a.id)]);
  assert.deepEqual(ok(['task', 'ready', String(p.id)]).map(x => x.id), [b.id]);
  ok(['task', 'complete', String(b.id)]);
  assert.deepEqual(ok(['task', 'ready', String(p.id)]).map(x => x.id), [c.id]);
});

test('completion is blocked by unfinished prerequisites, persists, and is idempotent', (t) => {
  const { file, ok, fail } = fixture(t);
  const p = project(ok(['project', 'add', 'Flow']));
  const a = taskRow(ok(['task', 'add', String(p.id), 'A']));
  const b = taskRow(ok(['task', 'add', String(p.id), 'B']));
  ok(['task', 'depend', String(b.id), String(a.id)]);
  fail(['task', 'complete', String(b.id)]);
  const doneA = taskRow(ok(['task', 'complete', String(a.id)]));
  assert.equal(doneA.status, 'done');
  const doneB = taskRow(ok(['task', 'complete', String(b.id)]));
  assert.equal(doneB.status, 'done');
  const bytes = readFileSync(file);
  assert.deepEqual(taskRow(ok(['task', 'complete', String(b.id)])), doneB);
  assert.deepEqual(readFileSync(file), bytes);
  assert.deepEqual(ok(['task', 'ready', String(p.id)]), []);
});

test('reports derive counts and ready IDs from the persisted graph', (t) => {
  const { ok } = fixture(t);
  const p = project(ok(['project', 'add', 'Report']));
  const a = taskRow(ok(['task', 'add', String(p.id), 'A']));
  const b = taskRow(ok(['task', 'add', String(p.id), 'B']));
  const c = taskRow(ok(['task', 'add', String(p.id), 'C']));
  ok(['task', 'depend', String(c.id), String(a.id)]);
  assert.deepEqual(ok(['project', 'report', String(p.id)]),
    { projectId: p.id, total: 3, open: 3, done: 0, readyTaskIds: [a.id, b.id] });
  ok(['task', 'complete', String(a.id)]);
  assert.deepEqual(ok(['project', 'report', String(p.id)]),
    { projectId: p.id, total: 3, open: 2, done: 1, readyTaskIds: [b.id, c.id] });
});

test('projects and separate storage files stay isolated', (t) => {
  const { file, ok } = fixture(t);
  const otherFile = join(file + '-other');
  const p = project(ok(['project', 'add', 'First']));
  const q = project(ok(['project', 'add', 'Second'], otherFile));
  const first = taskRow(ok(['task', 'add', String(p.id), 'One']));
  const second = taskRow(ok(['task', 'add', String(q.id), 'Two'], otherFile));
  assert.deepEqual(ok(['task', 'list', String(p.id)]).map(taskRow), [first]);
  assert.deepEqual(ok(['task', 'list', String(q.id)], otherFile).map(taskRow), [second]);
  assert.deepEqual(ok(['project', 'list']).map(project), [p]);
  assert.deepEqual(ok(['project', 'list'], otherFile).map(project), [q]);
});

test('invalid IDs and unknown tasks preserve persisted bytes', (t) => {
  const { ok, fail } = fixture(t);
  const p = project(ok(['project', 'add', 'Keep']));
  const a = taskRow(ok(['task', 'add', String(p.id), 'Keep task']));
  for (const id of ['0', '-1', '1.5', '1x', '1e0', '9007199254740992', '999999']) {
    fail(['task', 'complete', id]);
    fail(['task', 'depend', String(a.id), id]);
  }
  fail(['task', 'complete']);
  fail(['task', 'ready']);
  fail(['project', 'report', '999999']);
  assert.deepEqual(ok(['task', 'list', String(p.id)]).map(taskRow), [a]);
});
