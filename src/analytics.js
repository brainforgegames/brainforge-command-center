// Fixed IST offset: India has no daylight-saving transitions.
export const HOUR = 3600000, DAY = 24 * HOUR, IST = 330 * 60000;
export const istDate = t => new Date(t + IST).toISOString().slice(0, 10);
export const hourStart = t => Math.floor((t + IST) / HOUR) * HOUR - IST;
export const dayStart = t => Math.floor((t + IST) / DAY) * DAY - IST;
export function splitRun(start, end) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const rows = [];
  for (let t = start; t < end;) {
    const stop = Math.min(end, hourStart(t) + HOUR);
    // Exclude the daily 23:00–00:00 pause even if process shutdown was delayed.
    if (new Date(t + IST).getUTCHours() !== 23)
      rows.push({ date: istDate(t), hour: new Date(t + IST).getUTCHours(), milliseconds: stop - t });
    t = stop;
  }
  return rows;
}
export function analyticsView(days = [], period = 'today', now = Date.now()) {
  const count = period === 'today' ? 24 : period === '7' ? 7 : 30;
  const step = period === 'today' ? HOUR : DAY;
  const start = dayStart(now) - (period === 'today' ? 0 : (count - 1) * DAY);
  const buckets = Array.from({ length: count }, (_, i) => ({
    start: start + i * step, milliseconds: 0, completed: 0, input: 0, output: 0, cached: 0,
    runs: 0, tokenRuns: 0, partialRuns: 0, partialTokenRuns: 0,
    label: period === 'today' ? `${String(i).padStart(2, '0')}:00` : istDate(start + i * step),
  }));
  const projects = new Map();
  for (const day of Array.isArray(days) ? days : []) for (const row of Array.isArray(day.rows) ? day.rows : []) {
    if (typeof day.id !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day.id) || typeof row?.projectId !== 'string' || !Number.isInteger(row.hour) || row.hour < 0 || row.hour > 23) continue;
    const time = Date.parse(`${day.id}T00:00:00+05:30`) + row.hour * HOUR;
    if (!Number.isFinite(time)) continue;
    const i = Math.floor((time - start) / step);
    if (i < 0 || i >= count || time > now) continue;
    const p = projects.get(row.projectId) || { id: row.projectId, milliseconds: 0, completed: 0, input: 0, output: 0, cached: 0, runs: 0, tokenRuns: 0, partialRuns: 0, partialTokenRuns: 0 };
    for (const key of ['milliseconds', 'completed', 'input', 'output', 'cached', 'runs', 'tokenRuns', 'partialRuns', 'partialTokenRuns']) {
      const value = Number.isFinite(row[key]) && row[key] >= 0 ? row[key] : 0;
      buckets[i][key] += value; p[key] += value;
    }
    projects.set(row.projectId, p);
  }
  const ranked = [...projects.values()].sort((a, b) => b.milliseconds - a.milliseconds || a.id.localeCompare(b.id));
  const total = ranked.reduce((s, p) => s + p.milliseconds, 0);
  return { buckets, projects: ranked.map(p => ({ ...p, share: total ? p.milliseconds / total * 100 : 0 })), total };
}
export const workerTime = ms => ms >= HOUR ? `${(ms / HOUR).toFixed(1)} hr` : `${(ms / 60000).toFixed(1)} min`;
