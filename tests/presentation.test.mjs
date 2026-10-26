import test from "node:test";
import assert from "node:assert/strict";
import {
  priorityProjects,
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
  assert.match(report.sections.find((s) => s.heading === "Ready for review today").items[0], /Reviewed the quiz flow/);
  assert.match(report.sections.find((s) => s.heading === "Your help").items[0], /Nothing needed/);
});
test("offline heartbeat is not presented as active work", () => {
  const s = initialState(),
    now = Date.parse("2026-10-24T18:00:00+05:30");
  s.settings.workerEnabled = true;
  s.worker.lastSeen = now - 6 * 60000;
  s.tasks = [{ projectId:"sikhi-khoj", status: "running" }];
  assert.match(workerView(s, now).title, /Waiting for laptop/);
  s.worker.lastSeen = now;
  assert.equal(workerView(s, now).title, "Work is moving");
  s.projects.find(p=>p.id==="sikhi-khoj").weight=0;
  assert.equal(workerView(s, now).title, "Ready for the next step");
});

for (const mixed of [false, true]) {
  test(mixed ? "mixed days separate completed and review results" : "review-only days have no completed results", () => {
    const state = initialState();
    const now = Date.parse("2026-10-25T00:10:00+05:30");
    state.tasks = [
      { id: "review", status: "review", updatedAt: now, ownerUpdate: { done: "Quiz ready for checks." } },
      { id: "yesterday", status: "done", updatedAt: Date.parse("2026-10-24T23:59:59+05:30") },
      { id: "old-review", status: "review", updatedAt: Date.parse("2026-10-24T23:59:59+05:30") },
      ...(mixed ? [{ id: "done", status: "done", updatedAt: Date.parse("2026-10-25T00:00:00+05:30"), ownerUpdate: { done: "Scoring fixed." } }] : []),
    ];
    const summary = studioSummary(state, now);
    assert.deepEqual(summary.completed.map((t) => t.id), mixed ? ["done"] : []);
    assert.deepEqual(summary.readyForReview.map((t) => t.id), ["review"]);
    assert.equal(summary.checking.length, 2);
    assert.equal(summary.questions.length, 0);
    const report = makeReport(state, "2026-10-25", now);
    const completed = report.sections.find((s) => s.heading === "Completed today").items.join(" ");
    const review = report.sections.find((s) => s.heading === "Ready for review today").items.join(" ");
    assert.doesNotMatch(completed, /Quiz ready/);
    assert.match(completed, mixed ? /Scoring fixed.*IST/ : /No completed result/);
    assert.match(review, /Quiz ready.*IST/);
    assert.doesNotMatch(review, /Scoring fixed/);
    assert.match(review, /I handle the review/);
    assert.match(report.sections.find((s) => s.heading === "Your help").items[0], /Nothing needed/);
  });
}

test("project lists prioritize enabled shares and place parked projects last without mutating input", () => {
 const projects=[{id:'paused',weight:95,enabled:false},{id:'bcc',weight:10,enabled:true},{id:'sikhi',weight:90,enabled:true},{id:'zero',weight:0,enabled:true}];
 assert.deepEqual(priorityProjects(projects).map(p=>p.id),['sikhi','bcc','paused','zero']);
 assert.equal(projects[0].id,'paused');
});
