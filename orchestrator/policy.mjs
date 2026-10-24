import { isPaused, istParts, selectTask } from "../src/domain.js";
import { ownerView, studioSummary } from "../src/presentation.js";
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
    sections: (() => {
      const s = studioSummary(state, now);
      const projectPlans = (state.projects || [])
        .filter((p) => p.nextPlan)
        .map((p) => `${p.name}: ${p.nextPlan}`);
      const label = (t) =>
        `${{ "sikhi-khoj": "Sikhi Khoj", drivenix: "Drivenix", studio: "Brainforge studio", "reflex-trainer": "Reflex Trainer" }[t.projectId] || "Project"}: `;
      return [
        {
          heading: "What was done",
          items: s.completed
            .map((t) => label(t) + ownerView(t).done)
            .concat(
              s.completed.length
                ? []
                : ["No completed result recorded today yet."],
            ),
        },
        {
          heading: "What got in the way",
          items: s.issues
            .map((t) => label(t) + ownerView(t).issue)
            .concat(
              s.issues.length ? [] : ["No unresolved task issues recorded."],
            ),
        },
        {
          heading: "What happens next",
          items: [...s.active, ...s.planned]
            .map((t) => label(t) + ownerView(t).next)
            .concat(
              s.active.length + s.planned.length
                ? []
                : [
                    ...(projectPlans.length
                      ? projectPlans
                      : [
                          "Finish pending reviews and investigate issues. When no agreed task remains, research ideas and propose a plan before changing the product.",
                        ]),
                  ],
            ),
        },
        {
          heading: "Your help",
          items: s.questions
            .map((t) => label(t) + ownerView(t).question)
            .concat(
              s.questions.length
                ? []
                : [
                    "Nothing needed from you right now. Technical issues stay with me unless I ask a specific question.",
                  ],
            ),
        },
      ];
    })(),
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
      `Checks, reviews and merging are handled by the worker. Only Play Store and App Store publishing remain user-controlled. No purchased credits or API billing fallback.`,
    ].join("\n"),
  };
}
