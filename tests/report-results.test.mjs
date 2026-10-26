import test from "node:test";
import assert from "node:assert/strict";
import { taskResults, reportSections, validResults } from "../src/report-results.js";
import { makeReport } from "../orchestrator/policy.mjs";
import { initialState } from "../src/domain.js";
import { ownerView } from "../src/presentation.js";
import { reportEntry } from "../src/reading.js";

const results = [
  { category: "completed", text: "Security support improved." },
  { category: "limitation", text: "Google and Apple login are not available yet." },
  { category: "pending", text: "Device checks are pending." },
  { category: "proposal", text: "Consider adding passkeys." },
  { category: "next", text: "Check the sign-in screen." },
];
test("finished report contains only completed outcomes; limitations and plans remain separate", () => {
  const state = initialState(), now = Date.parse("2026-10-26T12:00:00+05:30");
  state.tasks = [{id: "security", projectId: "drivenix", status: "done", updatedAt: now,
    ownerUpdate: {done: "Security support improved. Google and Apple login are not available yet.", results}}];
  const report = makeReport(state, "2026-10-26", now);
  const sections = reportSections(report);
  const completed = sections.find(s => s.category === "completed");
  assert.equal(completed.items.length, 1);
  assert.match(reportEntry(completed.items[0]).items[0], /Security support improved/);
  assert.doesNotMatch(JSON.stringify(completed), /Google|Apple|pending|passkeys|Check the/);
  const details = sections.find(s => s.category === "details").items.join("\n");
  for (const item of results.slice(1)) assert.ok(details.includes(item.text));
  assert.equal(ownerView(state.tasks[0]).done, "Security support improved.");
});
test("task completion, brief rewrites and review status cannot certify unclassified notes", () => {
  const task = {status: "done", ownerUpdate: {done: "Google login not available yet.", brief: {done: "Google login added."}}};
  assert.deepEqual(taskResults(task).completed, []);
  assert.equal(taskResults(task).details.length, 2);
  assert.match(ownerView(task).done, /No verified outcome/);
  assert.deepEqual(taskResults({status: "review", ownerUpdate: {results}}).completed, []);
  assert.deepEqual(taskResults({status: "done", ownerUpdate: {results: [{category:"unknown",text:"Added login."}]}}).completed, []);
  assert.equal(validResults([{category:"completed",text:" "}]), false);
});
test("legacy report projection preserves every original string without editing private data", () => {
  const report = {ownerSections: [{heading:"What was finished", items:["Security improved. Google and Apple login not available yet."]}],
    sections: [{heading:"Completed today", items:["Old note."]}], body:"Original evidence"};
  const before = JSON.stringify(report);
  const projected = reportSections(report);
  assert.equal(projected[0].category, "details");
  assert.deepEqual(projected[0].items, report.ownerSections[0].items);
  assert.equal(JSON.stringify(report), before);
  assert.deepEqual(reportSections({sections:projected}), projected);
  assert.equal(reportSections({sections:report.sections})[0].category, "details");
});
test("completed categories do not silently remove real accomplishments based on keywords", () => {
  const text = "Fixed pending-check labels and Google login error messages.";
  assert.deepEqual(taskResults({status:"done",ownerUpdate:{results:[{category:"completed",text}]}}).completed,[text]);
  const invalid = reportSections({sections:[{heading:"Completed today",category:"completed",items:[{category:"pending",status:"done",text:"Checks pending."}]}]});
  assert.equal(invalid[0].category,"details");
});

test("legacy limitations and future notes remain in details alongside structured outcomes", () => {
  const task = {status:"done", ownerUpdate:{results,
    issue:"Google login still needs device verification.", next:"Check Apple login next.",
    brief:{issue:"Apple login remains unavailable.",next:"Review device results."}}};
  const projected = taskResults(task);
  for (const note of [task.ownerUpdate.issue, task.ownerUpdate.next,
    task.ownerUpdate.brief.issue, task.ownerUpdate.brief.next]) {
    assert.ok(projected.details.includes(note));
    assert.ok(!projected.completed.includes(note));
  }
});
