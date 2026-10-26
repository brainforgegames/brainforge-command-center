import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { recordRun, completeVerifiedTask } from '../orchestrator/analytics.mjs';
import { analyticsView, HOUR } from '../src/analytics.js';
const require = createRequire(import.meta.url), { Firestore } = require('@google-cloud/firestore');
test('real Firestore retries preserve parallel run totals and unique verified completions', async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw Error('Run only through the Firestore emulator.');
  const db = new Firestore({ projectId: 'demo-bcc-analytics' });
  const start = Date.parse('2026-10-27T10:00:00+05:30');
  const run = { id: 'synthetic-a', projectId: 'a', start, end: start + HOUR, usage: { input: 100, output: 10, cached: 60 }, state: 'finished' };
  try {
    await Promise.all([recordRun(db, run), recordRun(db, run), recordRun(db, { ...run, id: 'synthetic-b', projectId: 'b', usage: null })]);
    await db.doc('tasks/synthetic').set({ projectId: 'a', status: 'review', evidence: [{ passed: true }] });
    await Promise.all([completeVerifiedTask(db, 'synthetic', start + HOUR), completeVerifiedTask(db, 'synthetic', start + HOUR)]);
    const days = (await db.collection('analyticsDays').get()).docs.map(d => ({ id: d.id, ...d.data() }));
    const view = analyticsView(days, 'today', start + HOUR);
    assert.equal(view.total, 2 * HOUR);
    assert.equal(view.buckets[11].runs, 2);
    assert.equal(view.buckets[11].input, 100);
    assert.equal(view.buckets[11].completed, 1);
    assert.equal((await db.doc('tasks/synthetic').get()).data().completedAt, start + HOUR);
  } finally {
    for (const name of ['tasks', 'analyticsDays', 'analytics', 'analyticsRuns', 'analyticsCompletions']) {
      const docs = await db.collection(name).get();
      await Promise.all(docs.docs.map(d => d.ref.delete()));
    }
    await db.terminate();
  }
});
