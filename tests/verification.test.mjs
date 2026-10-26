import test from "node:test";
import assert from "node:assert/strict";
import { verificationEvidence as evidence, runVerification, verificationIssue } from "../orchestrator/verification.mjs";

test("classifies explicit failure signals without treating hints as proven causes", () => {
  for (const [err, category] of [
    ["spawn EACCES", "process_access"],
    ["spawn EPERM", "process_access"],
    ["Access is denied", "process_access"],
    ["Cannot find module 'tool'", "missing_dependency"],
    ["ERR_MODULE_NOT_FOUND", "missing_dependency"],
    ["AssertionError: expected true", "product_assertion"],
    ["Failed tests: 2", "unknown"],
    ["network error", "unknown"],
    ["AssertionError followed by EPERM", "mixed"],
  ]) {
    const result = evidence({ code: 1, err });
    assert.equal(result.category, category);
    assert.equal(result.passed, false);
    assert.ok(verificationIssue(result).length <= 240);
  }
  assert.match(verificationIssue(evidence({ code: 1, err: "EPERM" })), /possible/);
});

test("exit and stop state remain independent and bounded", () => {
  assert.deepEqual(evidence({ code: 0, err: "AssertionError in a passing test fixture" }), {
    command: "Quality check 1", passed: true, exitCode: 0,
    stopped: false, timedOut: false, category: "none",
  });
  assert.equal(evidence({ code: 0, stopped: true }).passed, false);
  assert.equal(evidence({ code: null, stopped: true }).category, "stopped");
  assert.equal(evidence({ code: null, stopped: true, timedOut: true }).category, "timeout");
  assert.equal(evidence({ code: 1, timedOut: true, err: "AssertionError" }).category, "mixed");
  assert.equal(evidence({ code: "private" }).exitCode, null);
  assert.equal(evidence({ code: 1, err: "x".repeat(32768) + "EPERM" }).category, "unknown");
});

test("serialized evidence cannot retain private strings or arbitrary result fields", async () => {
  const privateText = "C:\\Users\\PrivatePerson\\research SECRET_API_KEY=sk-private-secret unpublished strategy";
  const result = await runVerification(async () => ({
    code: 1, stopped: false, out: privateText, err: `EPERM ${privateText}`,
    env: { TOKEN: privateText }, command: privateText, researchBody: privateText,
  }), 3);
  assert.equal(result.category, "process_access");
  assert.equal(result.command, "Quality check 3");
  const serialized = JSON.stringify(result);
  for (const secret of [privateText, "PrivatePerson", "sk-private-secret", "strategy", "TOKEN", "researchBody"])
    assert.equal(serialized.includes(secret), false);
  assert.ok(serialized.length < 200);
  const success = evidence({ code: 0, out: privateText, err: privateText }, privateText);
  assert.equal(success.command, "Quality check 1");
  assert.equal(JSON.stringify(success).includes(privateText), false);
  let productRuns = 0;
  const productFailure = await runVerification(async () => {
    productRuns++;
    return { code: 1, err: "AssertionError" };
  }, 1);
  assert.equal(productRuns, 1);
  assert.equal(productFailure.category, "product_assertion");
  for (const [code, category] of [["EPERM", "process_access"], ["EACCES", "process_access"], ["ENOENT", "missing_dependency"], ["SECRET", "unknown"]]) {
    let calls = 0;
    const failure = await runVerification(async () => {
      calls++;
      throw Object.assign(new Error(privateText), { code, path: privateText });
    }, 2);
    assert.equal(calls, 1, "failures must never be automatically retried");
    assert.equal(failure.category, category);
    assert.equal(failure.exitCode, null);
    assert.equal(JSON.stringify(failure).includes(privateText), false);
  }
});
