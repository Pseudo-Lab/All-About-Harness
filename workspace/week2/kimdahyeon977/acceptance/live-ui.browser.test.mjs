import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { appendFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const at = '2026-10-22T00:00:00.000Z';
const row = (seq, event, rest = {}) => ({ seq, at, event, ...rest });
const lines = rows => rows.map(value => JSON.stringify(value)).join('\n') + '\n';
const { chromium } = await import(process.env.RALPH_PLAYWRIGHT_MODULE);
const executablePath = process.env.RALPH_CHROMIUM_EXECUTABLE;
assert.ok(executablePath, 'RALPH_CHROMIUM_EXECUTABLE is required for the browser suite');

async function fixture(t, rows) {
  const dir = await mkdtemp(join(tmpdir(), 'ralph-ui-browser-'));
  const file = join(dir, 'events.jsonl');
  await writeFile(file, lines(rows));
  const child = spawn(process.execPath, [resolve(process.cwd(), 'server.mjs')], {
    cwd: process.cwd(), env: { ...process.env, PORT: '0', RALPH_EVENTS_FILE: file },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => { child.kill('SIGTERM'); await rm(dir, { recursive: true, force: true }); });
  const port = await new Promise((done, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(Error('server start timed out')), 5000);
    child.once('exit', code => { clearTimeout(timer); reject(Error(`server exited ${code}`)); });
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = /READY (\d+)/.exec(output);
      if (match) { clearTimeout(timer); done(Number(match[1])); }
    });
  });
  const browser = await chromium.launch({ headless: true, executablePath });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.getByText('Connected', { exact: true }).waitFor();
  return { page, file };
}

test('browser treats every event string as plain text and round selection works', async t => {
  const payload = 'ready"><img src=x onerror="window.__ralphXss=1">';
  const f = await fixture(t, [
    row(1, 'run/start'),
    row(2, 'round/start', { round: 1, handoff: '' }),
    row(3, 'child/start', { round: 1, role: 'implementation', childId: 'one' }),
    row(4, 'child/end', { round: 1, role: 'implementation', childId: 'one', status: 'ready', summary: 'First round' }),
    row(5, 'round/end', { round: 1, result: 'continue' }),
    row(6, 'round/start', { round: 2, handoff: '<script>window.__ralphXss=2</script>' }),
    row(7, 'child/start', { round: 2, role: 'implementation', childId: 'two' }),
    row(8, 'child/end', { round: 2, role: 'implementation', childId: 'two', status: payload, summary: 'Second round' }),
  ]);
  const { page } = f;
  await page.locator('#round-selector option').last().waitFor({ state: 'attached' });
  await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(() => ({ flag: window.__ralphXss ?? 0, images: document.querySelectorAll('img').length })),
    { flag: 0, images: 0 });
  assert.ok((await page.locator('body').innerText()).includes(payload));
  await page.selectOption('#round-selector', '2');
  assert.ok((await page.locator('#rounds-container').innerText()).includes('Round 2'));
  assert.ok(!(await page.locator('#rounds-container').innerText()).includes('Round 1'));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
});

test('an open browser receives a new child result without reload', async t => {
  const f = await fixture(t, [
    row(1, 'run/start'),
    row(2, 'round/start', { round: 1, handoff: '' }),
    row(3, 'child/start', { round: 1, role: 'implementation', childId: 'live-child' }),
  ]);
  const { page, file } = f;
  assert.ok(!(await page.locator('#rounds-container').innerText()).includes('Completed live work'));
  await appendFile(file, lines([row(4, 'child/end', { round: 1, role: 'implementation', childId: 'live-child', status: 'ready', summary: 'Completed live work' })]));
  await page.getByText('Completed live work', { exact: true }).waitFor({ timeout: 5000 });
});

test('stage flow keeps child summaries, host test details, and handoff visible', async t => {
  const f = await fixture(t, [
    row(1, 'run/start'),
    row(2, 'round/start', { round: 1, handoff: '' }),
    row(3, 'child/start', { round: 1, role: 'implementation', childId: 'impl-one' }),
    row(4, 'child/end', { round: 1, role: 'implementation', childId: 'impl-one', status: 'ready', summary: 'Implemented validation API' }),
    row(5, 'child/start', { round: 1, role: 'test', childId: 'test-one' }),
    row(6, 'child/end', { round: 1, role: 'test', childId: 'test-one', status: 'fail', summary: 'Missing negative ID check' }),
    row(7, 'acceptance/end', { round: 1, kind: 'assertion-failure', exitCode: 1, testsRun: 5, passed: 4, failed: 1, summary: 'negative ID case failed' }),
    row(8, 'round/end', { round: 1, result: 'continue' }),
    row(9, 'round/start', { round: 2, handoff: 'negative ID case failed' }),
  ]);
  await f.page.locator('#rounds-container').getByText('Round 2', { exact: true }).waitFor();
  const details = await f.page.locator('#rounds-container').innerText();
  for (const expected of ['Implementation', 'Test', 'Host', 'Implemented validation API',
    'Missing negative ID check', 'negative ID case failed', '4/5']) {
    assert.ok(details.toLowerCase().includes(expected.toLowerCase()), `missing ${expected}`);
  }
});

test('long child reports keep the stage flow readable at desktop and mobile widths', async t => {
  const report = 'completed:' + 'validation_and_streaming_'.repeat(60);
  const f = await fixture(t, [
    row(1, 'run/start'),
    row(2, 'round/start', { round: 1, handoff: '' }),
    row(3, 'child/start', { round: 1, role: 'implementation', childId: 'long-report' }),
    row(4, 'child/end', { round: 1, role: 'implementation', childId: 'long-report', status: 'ready', summary: report }),
    row(5, 'child/start', { round: 1, role: 'test', childId: 'tester' }),
    row(6, 'child/end', { round: 1, role: 'test', childId: 'tester', status: 'pass', summary: 'Verified report' }),
    row(7, 'acceptance/end', { round: 1, kind: 'passed', exitCode: 0, testsRun: 4, passed: 4, failed: 0, summary: '4/4 pass' }),
  ]);
  await f.page.locator('.stage-summary').first().waitFor({ state: 'attached' });
  for (const width of [1440, 390]) {
    await f.page.setViewportSize({ width, height: 900 });
    await f.page.locator('.stage-flow').waitFor();
    const flow = await f.page.locator('.stage-flow').evaluate(element => ({
      scroll: element.scrollWidth, client: element.clientWidth,
      available: document.getElementById('rounds-container').clientWidth,
      page: document.documentElement.scrollWidth,
      viewport: innerWidth,
      labels: [...element.querySelectorAll('.stage-label')].map(node => node.textContent.trim()),
      stages: [...element.querySelectorAll('.stage-item')].map(node => ({
        width: node.getBoundingClientRect().width,
        top: node.getBoundingClientRect().top,
      })),
    }));
    assert.deepEqual(flow.labels, ['Implementation', 'Test', 'Host Acceptance']);
    assert.ok(flow.client <= flow.available + 2 && flow.scroll <= flow.available + 2 && flow.page <= flow.viewport + 2,
      `${width}px stage flow has ${flow.scroll}px content in ${flow.available}px available space`);
    assert.ok(flow.stages.every(stage => stage.width >= 180), `${width}px stage cards are too narrow to read`);
    if (width === 1440) {
      assert.ok(Math.max(...flow.stages.map(stage => stage.top)) - Math.min(...flow.stages.map(stage => stage.top)) < 20,
        'desktop stages should form one row');
    } else {
      assert.ok(flow.stages[0].top < flow.stages[1].top && flow.stages[1].top < flow.stages[2].top,
        'mobile stages should form a vertical sequence');
    }
    const firstStage = f.page.locator('.stage-item').first();
    const disclosure = firstStage.locator('details');
    assert.equal(await disclosure.count(), 1, 'long reports need an expandable detail control');
    assert.equal(await disclosure.evaluate(element => element.open), false);
    assert.ok((await firstStage.locator('.stage-card').boundingBox()).height < 400,
      'collapsed report should keep the stage card compact');
    await disclosure.locator('summary').click();
    assert.ok((await firstStage.innerText()).includes(report), 'expanded report is missing');
    await disclosure.locator('summary').click();
  }
});

test('host stage exposes the actual test names and failure details', async t => {
  const tap = [
    'TAP version 13',
    '# Subtest: accepts a valid child result',
    'ok 1 - accepts a valid child result',
    '# Subtest: rejects a malformed child result',
    'not ok 2 - rejects a malformed child result',
    '  error: expected validation failure',
    '1..2',
    '# tests 2',
    '# pass 1',
    '# fail 1',
  ].join('\n');
  const f = await fixture(t, [
    row(1, 'run/start'),
    row(2, 'round/start', { round: 1, handoff: '' }),
    row(3, 'acceptance/start', { round: 1 }),
    row(4, 'acceptance/end', { round: 1, kind: 'assertion-failure', exitCode: 1,
      testsRun: 2, passed: 1, failed: 1, summary: tap }),
  ]);
  const host = f.page.locator('.stage-item').last();
  await host.getByText('1/2', { exact: true }).waitFor();
  const disclosure = host.locator('details');
  assert.equal(await disclosure.count(), 1, 'host test details need an expandable control');
  await disclosure.locator('summary').click();
  const visible = await host.innerText();
  for (const detail of ['accepts a valid child result', 'rejects a malformed child result',
    'not ok 2', 'expected validation failure']) {
    assert.ok(visible.includes(detail), `missing host test detail: ${detail}`);
  }
});
