import test from "node:test";
import assert from "node:assert/strict";
import { researchPath, validateResearch } from "../orchestrator/research.mjs";
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
