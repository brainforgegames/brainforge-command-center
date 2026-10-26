import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir as list } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import path from 'node:path';
import { splitRun, istDate, HOUR, IST } from '../src/analytics.js';
const hash = id => createHash('sha256').update(id).digest('hex');
const valid = n => Number.isSafeInteger(n) && n >= 0;
// Actual local CLI events match rollout total_token_usage (session cumulative).
// Subtract the pre-invocation baseline; never sum repeated terminal totals.
export function runUsage(events, baseline = { input: 0, output: 0, cached: 0 }) {
  const rows = events.filter(e => e.type === 'turn.completed' && e.usage).map(e => e.usage);
  if (!rows.length) return null;
  const u = rows.at(-1);
  if (!valid(u.input_tokens) || !valid(u.output_tokens) || !valid(u.cached_input_tokens) || u.cached_input_tokens > u.input_tokens) return null;
  if (!baseline) return null;
  const current = { input: u.input_tokens, output: u.output_tokens, cached: u.cached_input_tokens };
  const delta = Object.fromEntries(Object.keys(current).map(k => [k, current[k] - baseline[k]]));
  return Object.values(delta).every(valid) && delta.cached <= delta.input ? delta : null;
}
export function observedUsage(events, baseline, total) {
  const terminal = runUsage(events, baseline);
  if (terminal) return { usage: terminal, tokenPartial: false };
  const partial = total ? runUsage([{ type: 'turn.completed', usage: { input_tokens: total.input, output_tokens: total.output, cached_input_tokens: total.cached } }], baseline) : null;
  // An unchanged rollout after an aborted request does not establish zero usage.
  return partial && (partial.input || partial.output)
    ? { usage: partial, tokenPartial: true } : { usage: null, tokenPartial: false };
}
// Read only numeric usage from the matching local rollout; never upload its contents.
export async function sessionUsage(session, home = process.env.CODEX_HOME || path.join(homedir(), '.codex')) {
  if (!/^[a-f0-9-]{36}$/i.test(session || '')) return null;
  async function find(dir, depth = 0) {
    if (depth > 4) return null;
    for (const e of await list(dir, { withFileTypes: true }).catch(() => [])) {
      if (e.isFile() && e.name.endsWith(`-${session}.jsonl`)) return path.join(dir, e.name);
      if (e.isDirectory()) { const result = await find(path.join(dir, e.name), depth + 1); if (result) return result; }
    }
    return null;
  }
  const file = await find(path.join(home, 'sessions'));
  if (!file) return null;
  let total = null;
  try {
    for await (const line of createInterface({ input: createReadStream(file), crlfDelay: Infinity })) {
      try {
        const e = JSON.parse(line), u = e.payload?.info?.total_token_usage;
        if (e.type === 'event_msg' && e.payload?.type === 'token_count' && u) {
          const value = runUsage([{ type: 'turn.completed', usage: u }]);
          if (value) total = value;
        }
      } catch {}
    }
  } catch { return null; }
  return total;
}
function add(rows, projectId, hour, values) {
  let row = rows.find(r => r.projectId === projectId && r.hour === hour);
  if (!row) { row = { projectId, hour }; rows.push(row); }
  for (const [key, value] of Object.entries(values)) row[key] = (row[key] || 0) + value;
}
// A transaction writes the run ledger and all affected days together. Retrying is safe.
export async function recordRun(db, run) {
  if (typeof run.id !== 'string' || !run.id || typeof run.projectId !== 'string' || !run.projectId || !Number.isFinite(run.start) || !Number.isFinite(run.end) || run.end < run.start || run.end - run.start > 2 * HOUR) throw Error('Invalid analytics run');
  const usage = run.usage ? { input: run.usage.input, output: run.usage.output, cached: run.usage.cached } : null;
  if (usage && (!Object.values(usage).every(valid) || usage.cached > usage.input)) throw Error('Invalid analytics usage');
  const parts = splitRun(run.start, run.end);
  const endDate = istDate(run.end), endHour = new Date(run.end + IST).getUTCHours();
  const dates = [...new Set([...parts.map(p => p.date), endDate])];
  await db.runTransaction(async tx => {
    const ledger = db.doc(`analyticsRuns/${hash(run.id)}`), meta = db.doc('analytics/meta');
    const [seen, metadata, ...snapshots] = await Promise.all([tx.get(ledger), tx.get(meta), ...dates.map(d => tx.get(db.doc(`analyticsDays/${d}`)))]);
    if (seen.exists) return;
    const days = new Map(dates.map((d, i) => [d, snapshots[i].data() || { rows: [] }]));
    for (const p of parts) add(days.get(p.date).rows, run.projectId, p.hour, { milliseconds: p.milliseconds });
    add(days.get(endDate).rows, run.projectId, endHour, { runs: 1, partialRuns: run.state === 'interrupted-partial' ? 1 : 0, partialTokenRuns: usage && run.tokenPartial === true ? 1 : 0, tokenRuns: usage ? 1 : 0, ...(usage || {}) });
    for (const [date, day] of days) tx.set(db.doc(`analyticsDays/${date}`), day);
    // No prompts, output, task titles, credentials or session IDs are stored here.
    tx.set(ledger, { projectId: run.projectId, start: run.start, end: run.end, usage, tokenPartial: !!usage && run.tokenPartial === true, state: ['finished', 'failed', 'stopped', 'interrupted-partial'].includes(run.state) ? run.state : 'unknown' });
    tx.set(meta, { ...(metadata.data() || {}), startedAt: Math.min(metadata.data()?.startedAt || run.start, run.start), lastRecordedAt: Math.max(metadata.data()?.lastRecordedAt || 0, run.end) });
  });
}
// Only explicit, verified completion timestamps qualify. Never substitute updatedAt.
export function completionRecord(task) {
  if (!task.id || !task.projectId || task.status !== 'done' || task.completionVerified !== true || !Number.isFinite(task.completedAt) || task.completedAt <= 0) return null;
  return { id: task.id, projectId: task.projectId, at: task.completedAt };
}
export async function archiveCompletion(db, task) {
  const c = completionRecord(task);
  if (!c) return false;
  const date = istDate(c.at), hour = new Date(c.at + IST).getUTCHours();
  await db.runTransaction(async tx => {
    const ref = db.doc(`analyticsCompletions/${hash(c.id)}`), dayRef = db.doc(`analyticsDays/${date}`), metaRef = db.doc('analytics/meta');
    const [seen, snapshot, metadata] = await Promise.all([tx.get(ref), tx.get(dayRef), tx.get(metaRef)]);
    if (seen.exists) return;
    const day = snapshot.data() || { rows: [] };
    add(day.rows, c.projectId, hour, { completed: 1 });
    tx.set(dayRef, day); tx.set(ref, { projectId: c.projectId, at: c.at });
    tx.set(metaRef, { ...(metadata.data() || {}), completionsStartedAt: Math.min(metadata.data()?.completionsStartedAt || c.at, c.at) });
  });
  return true;
}
// Call at the verified completion transition, after review/merge as appropriate.
// Historical done tasks without a known completion time must remain unavailable.
export async function completeVerifiedTask(db, id, now = Date.now()) {
  return db.runTransaction(async tx => {
    const taskRef = db.doc(`tasks/${id}`), ledger = db.doc(`analyticsCompletions/${hash(id)}`);
    const date = istDate(now), dayRef = db.doc(`analyticsDays/${date}`), metaRef = db.doc('analytics/meta');
    const [snapshot, seen, daily, metadata] = await Promise.all([tx.get(taskRef), tx.get(ledger), tx.get(dayRef), tx.get(metaRef)]);
    if (seen.exists) return false;
    const task = snapshot.data();
    if (task?.status !== 'review' || !task.evidence?.length || task.evidence.some(e => e.passed !== true)) throw Error('Completion requires a reviewed task with passing verification evidence; historical completion dates cannot be inferred.');
    const day = daily.data() || { rows: [] };
    add(day.rows, task.projectId, new Date(now + IST).getUTCHours(), { completed: 1 });
    tx.update(taskRef, { status: 'done', completedAt: now, completionVerified: true, updatedAt: now });
    tx.set(ledger, { projectId: task.projectId, at: now });
    tx.set(dayRef, day);
    tx.set(metaRef, { ...(metadata.data() || {}), completionsStartedAt: metadata.data()?.completionsStartedAt || now });
    return true;
  });
}
