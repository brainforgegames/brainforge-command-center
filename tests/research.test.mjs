import test from "node:test";
import assert from "node:assert/strict";
import {
  researchPath,
  validateResearch,
  publishReview,
  validateProjectTask,
} from "../orchestrator/research.mjs";
test("idle research cannot smuggle code changes or credentials into an approved planning task", () => {
  const p = researchPath("2026-10-24"),
    body =
      "# Evidence\n" +
      "Observed source evidence. ".repeat(70) +
      "\n# Improvements\nPrioritized.\n# Checks\nUnverified device checks.\n# Blockers\nNone.";
  assert.equal(validateResearch([p], body, p), true);
  assert.throws(() => validateResearch([p, "Assets/Game.cs"], body, p), /only/);
  assert.throws(
    () => validateResearch([p], body + " glpat-abcdefghijklmnopqrstu", p),
    /credential/,
  );
  assert.throws(() => researchPath("../../secret"));
});
test("company and dashboard strategy stay private with distinct research paths", () => {
  assert.notEqual(
    researchPath("2026-10-24", "brainforge-company"),
    researchPath("2026-10-24", "bcc-improvements"),
  );
  assert.throws(() => researchPath("2026-10-24", "../escape"));
  assert.equal(
    publishReview({ kind: "research" }, { privateResearch: true }, true),
    false,
  );
  assert.equal(
    publishReview({ kind: "implementation" }, { privateResearch: true }, true),
    true,
  );
  assert.equal(publishReview({ kind: "implementation" }, {}, false), false);
  assert.throws(() =>
    validateProjectTask({ kind: "implementation" }, { researchOnly: true }),
  );
  assert.doesNotThrow(() =>
    validateProjectTask({ kind: "research" }, { researchOnly: true }),
  );
});
