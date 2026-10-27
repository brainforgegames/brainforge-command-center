import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { analyticsView, splitRun, istDate, HOUR, DAY } from '../src/analytics.js';
import { analyticsPage } from '../src/analytics-page.js';
import { runUsage, observedUsage, sessionUsage, recordRun, completionRecord, archiveCompletion, completeVerifiedTask } from '../orchestrator/analytics.mjs';
const at = s => Date.parse(s + '+05:30');
class DB {
  values = new Map(); serial = Promise.resolve();
  doc(path) { return { path }; }
  async runTransaction(fn) {
    const op = this.serial.then(async () => {
      const pending = [];
      const value = await fn({
        get: async ref => ({ exists: this.values.has(ref.path), data: () => structuredClone(this.values.get(ref.path)) }),
        set: (ref, value) => pending.push(() => this.values.set(ref.path, structuredClone(value))),
        update: (ref, value) => pending.push(() => this.values.set(ref.path, { ...this.values.get(ref.path), ...structuredClone(value) })),
      });
      pending.forEach(fn => fn()); return value;
    });
    this.serial = op.catch(() => {}); return op;
  }
  days() { return [...this.values].filter(([k]) => k.startsWith('analyticsDays/')).map(([k, v]) => ({ id: k.split('/')[1], ...v })); }
}
const usage = (input, output, cached) => ({ type: 'turn.completed', usage: { input_tokens: input, output_tokens: output, cached_input_tokens: cached } });
test('terminal cumulative usage is subtracted once across resume; unavailable baselines stay unavailable', () => {
  assert.deepEqual(runUsage([usage(100, 10, 60), usage(100, 10, 60)]), { input: 100, output: 10, cached: 60 });
  assert.deepEqual(runUsage([usage(160, 20, 90)], { input: 100, output: 10, cached: 60 }), { input: 60, output: 10, cached: 30 });
  assert.equal(runUsage([usage(160, 20, 90)], null), null);
  assert.equal(runUsage([usage(10, 20, 5)], { input: 100, output: 10, cached: 60 }), null);
  for (const e of [usage(-1, 1, 0), usage(1, 1, 2), usage(1.2, 1, 0), { type: 'turn.completed', usage: { usedPercent: 50 } }]) assert.equal(runUsage([e]), null);
  assert.equal(runUsage([{ type: 'item.completed', usage: { input_tokens: 3 } }]), null);
  const baseline = { input: 100, output: 10, cached: 60 };
  assert.deepEqual(observedUsage([], baseline, baseline), { usage: null, tokenPartial: false });
  assert.deepEqual(observedUsage([], baseline, { input: 160, output: 20, cached: 90 }), { usage: { input: 60, output: 10, cached: 30 }, tokenPartial: true });
  assert.deepEqual(observedUsage([usage(160, 20, 90)], baseline, baseline), { usage: { input: 60, output: 10, cached: 30 }, tokenPartial: false });
});
test('local session parsing reads only valid numeric usage and rejects path traversal', async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'bcc-analytics-'));
  const session = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  try {
    await mkdir(path.join(home, 'sessions/2026/10/27'), { recursive: true });
    await writeFile(path.join(home, `sessions/2026/10/27/rollout-date-${session}.jsonl`), ['bad line', JSON.stringify({ type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: usage(100, 10, 60).usage } } }), JSON.stringify({ type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: usage(160, 20, 90).usage } } })].join('\n'));
    assert.deepEqual(await sessionUsage(session, home), { input: 160, output: 20, cached: 90 });
    assert.equal(await sessionUsage('../../secrets', home), null);
  } finally { await rm(home, { recursive: true, force: true }); }
});
test('IST hourly splitting excludes daily pause and crosses date boundaries correctly', () => {
  assert.deepEqual(splitRun(at('2026-10-26T22:30:00'), at('2026-10-27T00:30:00')), [
    { date: '2026-10-26', hour: 22, milliseconds: HOUR / 2 },
    { date: '2026-10-27', hour: 0, milliseconds: HOUR / 2 },
  ]);
  assert.equal(istDate(Date.parse('2026-10-26T18:30:00Z')), '2026-10-27');
  assert.deepEqual(splitRun(100, 99), []);
});
test('parallel runs, retries and report cleanup retain accurate durable project buckets', async () => {
  const db = new DB(), start = at('2026-10-27T10:00:00');
  const run = { id: 'private-run-id', projectId: 'a', start, end: start + HOUR, usage: { input: 100, output: 10, cached: 60 }, state: 'finished', prompt: 'DO NOT STORE', token: 'DO NOT STORE' };
  await Promise.all([recordRun(db, run), recordRun(db, run), recordRun(db, { ...run, id: 'second', projectId: 'b', usage: null })]);
  const view = analyticsView(db.days(), 'today', start + HOUR);
  assert.equal(view.total, 2 * HOUR); assert.equal(view.buckets[10].milliseconds, 2 * HOUR);
  assert.equal(view.buckets[11].tokenRuns, 1); assert.equal(view.buckets[11].runs, 2);
  assert.deepEqual(view.projects.map(p => p.share), [50, 50]);
  assert.equal(JSON.stringify([...db.values]).includes('DO NOT STORE'), false);
  db.values.set('reports/old', {}); db.values.delete('reports/old');
  assert.equal(analyticsView(db.days(), '30', start + HOUR).total, 2 * HOUR);
});
test('7 and 30 day windows use daily IST buckets and ignore old/future rows', () => {
  const now = at('2026-10-27T12:00:00');
  const days = ['2026-09-27', '2026-09-28', '2026-10-20', '2026-10-21', '2026-10-27', '2026-10-28'].map(id => ({ id, rows: [{ hour: 10, projectId: 'a', milliseconds: HOUR }] }));
  assert.equal(analyticsView(days, '7', now).total, 2 * HOUR);
  assert.equal(analyticsView(days, '30', now).total, 4 * HOUR);
  assert.equal(analyticsView(days, '30', now).buckets.length, 30);
  assert.equal(analyticsView([{ id: 'bad', rows: [{ projectId: 'a', hour: 1 }] }, { id: '2026-10-27', rows: 'bad schema' }, { id: '2026-10-27', rows: [{ hour: -1 }, null] }], 'today', now).total, 0);
});
test('only distinct verified completions count at completion time, never update time or draft status', async () => {
  const db = new DB(), completedAt = at('2026-10-20T08:00:00');
  const task = { id: 'one', projectId: 'a', status: 'done', completedAt, completionVerified: true, updatedAt: at('2026-10-27T09:00:00') };
  for (const bad of [{ ...task, status: 'review' }, { ...task, completedAt: undefined }, { ...task, completionVerified: false }]) assert.equal(completionRecord(bad), null);
  await archiveCompletion(db, task); await archiveCompletion(db, task);
  assert.equal(db.days()[0].id, '2026-10-20'); assert.equal(db.days()[0].rows[0].completed, 1);
  assert.equal(analyticsView(db.days(), 'today', task.updatedAt).buckets.reduce((s, b) => s + b.completed, 0), 0);
  assert.equal(analyticsView(db.days(), '30', task.updatedAt).buckets.reduce((s, b) => s + b.completed, 0), 1);
});
test('verified completion transition is atomic, idempotent and requires passing checks', async () => {
  const db = new DB(), now = at('2026-10-27T09:00:00');
  db.values.set('tasks/one', { projectId: 'a', status: 'review', evidence: [{ passed: false }] });
  await assert.rejects(completeVerifiedTask(db, 'one', now), /passing/);
  db.values.get('tasks/one').evidence = [{ passed: true }];
  assert.equal(await completeVerifiedTask(db, 'one', now), true);
  assert.equal(await completeVerifiedTask(db, 'one', now + DAY), false);
  assert.equal(db.values.get('tasks/one').completedAt, now);
  assert.equal(db.days()[0].rows[0].completed, 1);
  assert.equal(db.values.get('analytics/meta').completionsStartedAt, now);
});
test('analytics distinguishes unavailable history, empty activity, loading and access errors', () => {
  const state = { projects: [], worker: {}, analyticsDays: [], analyticsMeta: {}, analyticsLoaded: true };
  const html = analyticsPage(state, s => String(s), 'today', 'tokens', at('2026-10-27T09:00:00'));
  assert.match(html, /Unavailable history/); assert.match(html, /No recorded activity/);
  assert.match(html, /<caption>/); assert.match(html, /data-analytics-bucket/); assert.doesNotMatch(html, /Account plan snapshot/);
  assert.doesNotMatch(analyticsPage({ ...state, analyticsUnavailable: true }, String), /analytics-chart/);
  assert.match(analyticsPage({ ...state, analyticsLoaded: false }, String), /Loading private analytics/);
});

 test('token values use millions across summary, chart, projects and data details', () => {
 const now = at('2026-10-27T12:00:00');
 const state = {projects:[{id:'a',name:'Project A'}],worker:{},analyticsLoaded:true,analyticsMeta:{startedAt:at('2026-10-27T00:00:00')},analyticsDays:[{id:'2026-10-27',rows:[{hour:10,projectId:'a',input:1350031,output:582287,cached:1000000,tokenRuns:1,runs:1}]}]};
 const html=analyticsPage(state,String,'today','tokens',now);
 assert.match(html,/1.93M/); assert.match(html,/1.35M/); assert.match(html,/0.58M/); assert.match(html,/1.00M/);
 assert.doesNotMatch(html,/19,32,318|1,932,318/);
 assert.match(html,/Manual chat usage is not collected automatically/);
 assert.doesNotMatch(html,/Work time|Tasks completed|<th>Completed<|analytics-metric/);
 assert.match(html,/analytics-period/);
 });

 test('small positive token usage is not displayed as zero',()=>{
 const state={projects:[],worker:{},analyticsDays:[{id:'2026-10-27',rows:[{hour:1,projectId:'a',input:100,output:50,tokenRuns:1,runs:1}]}],analyticsMeta:{startedAt:at('2026-10-27T00:00:00')},analyticsLoaded:true};
 assert.match(analyticsPage(state,s=>String(s).replaceAll('<','&lt;'),'today','tokens',at('2026-10-27T09:00:00')),/&lt;0.01M/);
 });
