import test from "node:test";
import assert from "node:assert/strict";
import {
  ownerView,
  studioSummary,
  workerView,
  recentFirst,
} from "../src/presentation.js";
import { initialState } from "../src/domain.js";
import { makeReport } from "../orchestrator/policy.mjs";
test("ordinary technical failures and reviews never become owner questions", () => {
  const s = initialState();
  s.tasks = [
    { status: "blocked", blockedReason: "Filename too long" },
    { status: "review", result: "Draft created" },
  ];
  assert.equal(studioSummary(s).questions.length, 0);
  assert.equal(studioSummary(s).open.length, 2);
  assert.equal(studioSummary(s).checking.length, 1);
  assert.doesNotMatch(ownerView(s.tasks[0]).issue, /Filename/);
  s.tasks.push({
    status: "blocked",
    ownerUpdate: {
      needsOwner: true,
      question: "Which app name should we use?",
    },
  });
  assert.equal(studioSummary(s).questions.length, 1);
  s.tasks[2].status = "done";
  assert.equal(studioSummary(s).questions.length, 0);
});
test("today respects India midnight, updates sort newest first, reports share owner summaries", () => {
  const s = initialState(),
    now = Date.parse("2026-10-25T00:10:00+05:30");
  s.tasks = [
    { id: "old", status: "done", updatedAt: now - 20 * 60000 },
    {
      id: "new",
      status: "review",
      updatedAt: now - 5 * 60000,
      ownerUpdate: {
        done: "Reviewed the quiz flow.",
        next: "Fix the scoring issue.",
      },
    },
  ];
  assert.deepEqual(
    studioSummary(s, now).today.map((t) => t.id),
    ["new"],
  );
  assert.equal(recentFirst(s.tasks)[0].id, "new");
  const report = makeReport(s, "2026-10-25", now);
  assert.match(report.sections[0].items[0], /Reviewed the quiz flow/);
  assert.match(report.sections[3].items[0], /Nothing needed/);
});
test("offline heartbeat is not presented as active work", () => {
  const s = initialState(),
    now = Date.parse("2026-10-24T18:00:00+05:30");
  s.settings.workerEnabled = true;
  s.worker.lastSeen = now - 6 * 60000;
  s.tasks = [{ status: "running" }];
  assert.match(workerView(s, now).title, /Waiting for laptop/);
  s.worker.lastSeen = now;
  assert.equal(workerView(s, now).title, "Work is moving");
});
