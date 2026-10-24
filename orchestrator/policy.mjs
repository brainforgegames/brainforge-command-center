import { isPaused, istParts, selectTask } from "../src/domain.js";
export { isPaused, istParts, selectTask };
export function nextPause(now = new Date()) {
  const p = istParts(now);
  const midnightUTC = Date.parse(p.date + "T00:00:00+05:30");
  return new Date(midnightUTC + (p.hour >= 23 ? 47 : 23) * 3600000);
}
export function classifyFailure(events, stderr = "") {
  const errors = events.filter((e) =>
    ["error", "turn.failed"].includes(e.type),
  );
  const text = JSON.stringify(errors) + " " + stderr;
  return /usage.limit|rate.limit|quota.exceeded|limit.reached|exceeded.*limit/i.test(
    text,
  )
    ? "limit"
    : /auth|sign.in|log.in|credential/i.test(text)
      ? "auth"
      : "failed";
}
export function retryAt(events, now = Date.now()) {
  for (const e of events) {
    const value = e.error?.resets_at ?? e.error?.reset_at ?? e.resets_at;
    if (typeof value === "number" && value * 1000 > now) return value * 1000;
  }
  return now + 3600000;
}
export const REPORT_TTL = 30 * 86400000;
export function makeReport(state, date, now = Date.now()) {
  const counts = {};
  for (const t of state.tasks) counts[t.status] = (counts[t.status] || 0) + 1;
  return {
    date,
    title: "Daily studio report",
    createdAt: now,
    expiresAt: now + REPORT_TTL,
    body: [
      state.settings?.dailyPlan?.date === date
        ? state.settings.dailyPlan.body
        : "",
      `Task status: ${
        Object.entries(counts)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ") || "No tasks yet."
      }`,
      `Worker: ${state.worker?.status || "starting"}`,
      `Changed in the last 24 hours: ${state.tasks.filter((t) => (t.updatedAt || t.createdAt || 0) >= now - 86400000).length} tasks`,
      `Blocked tasks:`,
      ...state.tasks
        .filter((t) => t.status === "blocked")
        .map((t) => `• ${t.title}: ${t.blockedReason || "Needs attention"}`),
      `Ready for review:`,
      ...state.tasks
        .filter((t) => t.status === "review")
        .map((t) =>
          [
            `• ${t.title}: ${t.result || "See task evidence"}`,
            t.branch ? `  Branch: ${t.branch}` : "",
            t.pr ? `  PR: ${t.pr}` : "",
            ...(t.evidence || []).map(
              (e) => `  ${e.passed ? "PASS" : "FAIL"}: ${e.command}`,
            ),
          ]
            .filter(Boolean)
            .join("\n"),
        ),
      `Quota: ${state.worker?.quota == null ? "unavailable" : state.worker.quota + "% used (most used reported window)"}`,
      state.worker?.nextAttemptAt
        ? `Next retry: ${new Date(state.worker.nextAttemptAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`
        : "No quota retry deadline recorded.",
      `Releases remain user-controlled. No purchased credits or API billing fallback.`,
    ].join("\n"),
  };
}
