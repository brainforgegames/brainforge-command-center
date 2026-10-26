# Finished-work report correction

Updated 26 Oct 2026, 5:53 PM IST.

## Scope and evidence

Inspected the current task worktree and `bcc/screenshot-keyboard-fix` using read-only Git commands. No branch switches or shared Git metadata changes. PR12's Today overview, allocation advice, paused plans and screenshot changes are outside this patch.

Generation flows from worker JSON into task `ownerUpdate`, then `makeReport` in `orchestrator/policy.mjs`, saved by `orchestrator/report.mjs`. Previously, task status `done` certified the entire free-text progress note. Rendering selected `ownerSections` ahead of `sections`, with no classification of individual outcomes. A legacy brief could also replace the task's original progress wording.

New worker output categorizes individual short bullets. Only `completed` bullets on a `done` task enter finished results. Limitations, pending checks, proposals and future work stay in result details. Worker instructions require evidence for the classification; software cannot prove the truth of arbitrary prose. Existing checkpoints without categories remain readable, but cannot become certified finished outcomes from their status alone.

## Safe migration recommendation

Prefer the read-only `reportSections(report)` display projection first. It relabels known legacy finished headings as unverified notes and preserves every original item. It handles both `ownerSections` and `sections`. No private database writes are included or performed.

If historical reports need certified outcomes later:

- Export an access-controlled backup of each report and its source task evidence first; preserve original IDs, timestamps, expiry and notes.
- Review each outcome against evidence from that report date; current task status alone cannot establish historical completion.
- For the owner example, classify “Security support improved” as completed only with evidence; retain “Google and Apple login are not available yet” as a limitation.
- Prepare a separate reviewed projection with completed entries carrying category, done status, source task ID and text; keep limitations in a details section.
- Compare original and proposed records before any write; use an explicit per-record allowlist and concurrency preconditions, never bulk string replacement or deletion.
- Reapply the projection to confirm idempotence, unchanged original notes and unchanged retention. Reports without sufficient evidence remain unverified.

Regression fixtures test this projection without touching private data: mixed security/login notes, brief overrides, review status, malformed categories, proposals, pending checks, future work, unchanged originals, repeat projection and accomplishments containing words such as “pending”. Real private records were not accessed.

## Validation

Follow-up updated 27 Oct 2026, 12:00 AM IST.

Reconciled with PR12 tip `15d520a` by reading its source diff and applying compatible source hunks only. No branch switching or shared Git metadata writes. Today overview removal, time-split advice removal, paused next-step exclusion, priority sorting, parked counts and screenshot keyboard handling are preserved. Relative to that tip, the remaining tracked differences are the report-correctness patch; the helper, regression tests and this document are also untracked additions for review.

- Focused report, reading and presentation tests: 14 passed after the final note-preservation change.
- Full in-process suite with all preserved regressions: 61 passed; the existing real Git fixture was blocked at `git init` by `spawnSync git EPERM` (62 total).
- Configured `npm.cmd test` cannot spawn test subprocesses (`spawn EPERM`), so those failures are not product assertions.
- Configured `npm.cmd run build` cannot find the Vite command shim. The installed Vite entry exists; direct execution reaches esbuild and is blocked by `spawn EPERM`. No build pass is claimed.
- UI and worker syntax checks and `git diff --check` passed.

Dependencies already exist, so npm ci was not rerun. The supervisor reports that the earlier clean installation timed out; installation completion is not claimed. The normal runner must restore command shims as needed and run its configured tests/build outside sandbox process restrictions. Earlier rules/emulator verification remains pending; this patch changes no rules or data permissions. No private reports were read or written. All source remains uncommitted; nothing pushed, merged, deployed or published. Status is verify for host-only subprocess checks, not a claim of completed acceptance verification.

## Continuation verification ? 27 Oct 2026

Read current origin/main (55f15c0) and PR12 (15d520a) without branch changes or Git metadata writes. Restored main's bounded timeout retry and one-time setup repair behavior into the preserved worker, including repair instructions, checkpoint retention and retry reset. The worker diff against main now contains only categorized-result instructions and validation. Main's recovery helper and its tests are copied unchanged as source files because this task copy predates them. No recoverBlocked symbol exists in the inspected main source; no existing recovery code was removed or renamed. Unfinished outcomes remain excluded from finished sections. PR12 UI behavior and CSS remain untouched by this continuation.

Current checks: 19 focused report, reading, presentation, recovery and verification checks passed in process. Full in-process suite: 63 passed; one Git subprocess fixture blocked by spawnSync git EPERM. Configured npm test cannot spawn test processes (EPERM); configured npm run build reaches Vite but esbuild cannot spawn (EPERM). Worker and UI syntax checks and git diff --check passed. Dependencies were not reinstalled. Supervisor must run configured test/build on the host; no product assertion failure was observed. Changes from this continuation remain uncommitted. The starting task snapshot already tracked the prior report patch; no commit was created here.
