import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalRemote,
  expectedRemote,
  gitlabReviewPush,
} from "../orchestrator/repositories.mjs";
test("repo mappings cover GitLab and an explicitly authorized GitHub collaborator repo", () => {
  assert.equal(
    expectedRemote({
      provider: "gitlab",
      repository: "brainforgegames/drivenix",
    }),
    "https://gitlab.com/brainforgegames/drivenix",
  );
  assert.equal(
    canonicalRemote("git@github.com:Enigma990/Reflexer.git"),
    expectedRemote({ repository: "Enigma990/Reflexer" }),
  );
  assert.equal(
    canonicalRemote("https://gitlab.com/brainforgegames/drivenix.git"),
    "https://gitlab.com/brainforgegames/drivenix",
  );
  assert.throws(
    () =>
      canonicalRemote(
        "https://token:secret@gitlab.com/brainforgegames/drivenix.git",
      ),
    /embedded credentials/,
  );
  assert.throws(() =>
    canonicalRemote("https://github.com.attacker.invalid/x/y.git"),
  );
});
test("GitLab review push is draft-only and never enables merging or release", () => {
  const args = gitlabReviewPush(
    "bcc/task-x",
    "feature/phase2-environment",
    "Audit\nplan",
    "Summary\nChecks",
  );
  assert.ok(args.includes("merge_request.draft"));
  assert.ok(args.includes("merge_request.target=feature/phase2-environment"));
  assert.equal(
    args.some((v) => /auto_merge|merge_when_pipeline|\n/.test(v)),
    false,
  );
});
