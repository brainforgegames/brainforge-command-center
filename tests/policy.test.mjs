import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  selectTask,
  isPaused,
  istParts,
  reportDue,
  reportVisible,
  validateTask,
} from "../src/domain.js";
import {
  nextPause,
  classifyFailure,
  retryAt,
  makeReport,
  REPORT_TTL,
} from "../orchestrator/policy.mjs";
import { summarizeQuota } from "../orchestrator/quota.mjs";
test("quota waits for the latest exhausted window and treats missing as unknown", () => {
  const q = summarizeQuota(
    {
      rateLimitsByLimitId: {
        codex: {
          primary: { usedPercent: 100, resetsAt: 2000 },
          secondary: { usedPercent: 100, resetsAt: 9000 },
        },
      },
    },
    1000,
  );
  assert.equal(q.blockedUntil, 9060000);
  assert.equal(q.usedPercent, 100);
  assert.equal(summarizeQuota(null).usedPercent, null);
});
test("IST pause boundaries independent of Windows timezone", () => {
  assert.equal(isPaused(new Date("2026-10-24T17:29:59Z")), false);
  assert.equal(isPaused(new Date("2026-10-24T17:30:00Z")), true);
  assert.equal(isPaused(new Date("2026-10-24T18:29:59Z")), true);
  assert.equal(isPaused(new Date("2026-10-24T18:30:00Z")), false);
  assert.equal(istParts(new Date("2026-10-24T18:30:00Z")).date, "2026-10-25");
  assert.equal(
    nextPause(new Date("2026-10-24T16:00:00Z")).toISOString(),
    "2026-10-24T17:30:00.000Z",
  );
});
test("reports at 22 IST once per date with catch-up", () => {
  assert.equal(reportDue(new Date("2026-10-24T16:29:00Z"), null), false);
  assert.equal(reportDue(new Date("2026-10-24T16:30:00Z"), null), true);
  assert.equal(
    reportDue(new Date("2026-10-24T17:45:00Z"), "2026-10-24"),
    false,
  );
});
test("weights allocate time and skip blocked, unapproved and disabled tasks", () => {
  const p = initialState().projects;
  p[0].weight = 3;
  const t = p.map((p, i) => ({
    id: String(i),
    projectId: p.id,
    status: "queued",
    approved: true,
    priority: 1,
    createdAt: i,
  }));
  assert.equal(
    selectTask(p, t, { "sikhi-khoj": 3, drivenix: 2, "reflex-trainer": 2 }).id,
    "0",
  );
  t[0].status = "blocked";
  p[1].enabled = false;
  assert.equal(selectTask(p, t).id, "2");
  t[2].approved = false;
  assert.equal(selectTask(p, t), null);
});
test("weighted selection converges without starving projects", () => {
  const p = initialState().projects;
  p[0].weight = 3;
  const tasks = p.map((p) => ({
    projectId: p.id,
    status: "queued",
    approved: true,
    priority: 1,
    createdAt: 0,
  }));
  const served = {};
  for (let i = 0; i < 500; i++) {
    const task = selectTask(p, tasks, served);
    served[task.projectId] = (served[task.projectId] || 0) + 1;
  }
  assert.deepEqual(served, {
    drivenix: 100,
    "reflex-trainer": 100,
    "sikhi-khoj": 300,
  });
});
test("zero weight excludes work and priority applies inside project", () => {
  const p = initialState().projects;
  p[0].weight = 0;
  assert.equal(
    selectTask(p, [{ projectId: p[0].id, status: "queued", approved: true }]),
    null,
  );
  assert.throws(() =>
    validateTask({ title: "a", projectId: "sikhi-khoj", acceptance: "" }),
  );
});
test("limits checkpoint conservatively without inventing reset times", () => {
  assert.equal(
    classifyFailure([{ type: "error", message: "usage limit reached" }]),
    "limit",
  );
  assert.equal(
    classifyFailure([
      { type: "turn.failed", error: { message: "Rate limit exceeded" } },
    ]),
    "limit",
  );
  assert.equal(classifyFailure([], "Please log in"), "auth");
  assert.equal(retryAt([], 1000), 3601000);
  assert.equal(retryAt([{ error: { resets_at: 5000 } }], 1000), 5000000);
});
test("only reports expire at 30 days", () => {
  const s = initialState();
  s.tasks.push({
    title: "Needs login",
    status: "blocked",
    blockedReason: "Permission",
  });
  const report = makeReport(s, "2026-10-24", 1000);
  assert.equal(report.expiresAt, 1000 + REPORT_TTL);
  assert.equal(reportVisible(report, report.expiresAt - 1), true);
  assert.equal(reportVisible(report, report.expiresAt), false);
  assert.match(report.body, /Needs login: Permission/);
  assert.equal(s.projects.length, 3);
});
