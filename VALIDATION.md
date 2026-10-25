# Validation record

## 2026-10-25 00:04 IST — Windows worker preparation

Implemented a portable Windows worktree root (`LOCALAPPDATA/bcc/w`), an optional absolute `worktreeRoot` in local configuration, bounded hashed task directory names, and command-scoped Git long-path support. Existing task branch registrations, checkpoint locations and legacy folders take precedence over new locations. Ambiguous or missing worktrees and unregistered partial checkouts stop for inspection without reset, deletion, migration or pruning. No existing worktrees, checkpoints, local configuration, game files, registry settings or system security policies were changed. All implementation changes remain uncommitted.

Checks performed in the restricted Windows worker session:

- `node --test tests/*.test.mjs`: blocked by Node child-process `spawn EPERM` before test-file execution.
- `node --test --test-isolation=none tests/*.test.mjs`: **21 passed, 1 blocked/failed**. Passing checks cover the existing 18 tests plus root selection/absolute-path rejection, bounded collision-resistant names, new/existing branch preparation, command-scoped long paths, checkpoint/registered path precedence, spaces, dirty-file preservation and partial-folder preservation. The real Git fixture test fails at its first `git init` with `spawnSync git EPERM`; its long-path checkout and dirty-worktree resumption assertions have not executed.
- `node "<Node installation>/node_modules/npm/bin/npm-cli.js" run build`: Vite build blocked by esbuild `spawn EPERM` while loading configuration. Dependencies resolve from the existing parent installation. No dependency files were changed. Bare `npm` was also blocked by PowerShell script execution policy; using npm's Node entry point avoids that policy without changing it.
- `node --check orchestrator/worker.mjs`, `node --check orchestrator/worktrees.mjs` and `git diff --check`: passed.

Remaining verification: the orchestrator must run the complete `npm test` and `npm run build` in its normal execution environment, then retry the approved Drivenix/Sikhi Khoj setup with the new preparation code. The disposable Git integration test creates paths longer than 260 characters and checks that changing the configured root preserves edits in both source and task worktrees. Real project retries were not attempted: project repositories/configuration lie outside this approved worktree, and existing failed index state requires inspection before any recovery. Short paths and Git long-path support prevent known checkout pressure but do not establish that Sikhi Khoj's existing index is healthy. No owner decision is required for these technical follow-ups.

Validated on Windows 11 Home, Intel i7-13620H (10 cores / 16 threads), 32 GB RAM; Node 24.20.0 and Codex CLI 0.163.0-alpha.11. Approximately 233 GB disk space was free at inspection.

- Nine domain/policy tests pass: IST pause boundaries, reporting date/deduplication, weighted time allocation without starvation, disabled/unapproved/blocked task exclusion, quota windows and reset selection, and report expiry.
- Three Firestore emulator integration tests pass with Firebase CLI 15.33.0: unauthenticated and wrong-account isolation, admin-only task control, denied admin-identity/report/worker spoofing, and invalid document rejection.
- Production Vite build passes with configured Firebase values. Local browser checks verified task creation/persistence in demo mode and the configured admin sign-in gate. Phone-width (390px) navigation opens and document width remains 390px.
- Firebase project, web app, Google provider, owner identity and admin UID mapping are provisioned. Rules deployed successfully; Firestore seeding is create-only and was verified. A paused worker connected to the live database. Billing API confirmed `billingEnabled: false` and no billing account attached.
- The read-only Codex quota probe returned real short and weekly window values. These are account-wide snapshots, not per-task usage estimates.

Not yet validated: a human Google sign-in on the published site, a real interrupted task resumption, actual quota exhaustion/reset over time, or a 23:00 interruption observed at wall-clock time. Those boundaries have deterministic policy tests, not a completed overnight production trial. All project repositories are mapped. The website audit reached draft review; the Unity test setup still needs work.

The existing disabled `Brainforge Development Pipeline` Windows task was not modified.


2026-10-24 resumed validation: 12 unit tests pass, including remote identity and research scope checks. The standalone Windows worker successfully wrote an audit, passed the website smoke check and opened https://github.com/brainforgegames/sikhi-khoj-app/pull/1 as a draft. Drivenix and Reflexer mappings are verified; implementation checks remain pending. Tonight's dated improvement plan is saved for the report. Real quota reset and overnight pause observations remain pending.

Dashboard redesign: permanent charcoal theme; Today/Projects/Work board/Your help/Reports/Settings navigation. Removed feedback and instructions screens. Existing records now have owner-facing summaries and explicit next plans. Browser QA at 1440px and 390px verified project cards, project filtering, mobile navigation, owner-question copy flow, collapsed diagnostics and no horizontal overflow. 15 unit tests pass, including owner-question separation, IST date boundaries and stale-worker status. Daily reports now include readable structured sections alongside the preserved full record. Worker outputs require bounded owner-facing progress, issue, next step and a specific help question only when needed.

The first daily report was published at 22:00:45 IST on 2026-10-24 by the independent report job; its existing record was upgraded with readable sections without changing its publication or expiry timestamps.

Brand and allocation update: 18 unit tests and four Firestore integration tests pass. Added five-project allocation checks, exact percentage rounding, weighted scheduling with saved shares, zero-share exclusion, atomic batch rejection and wrong-account protection. Distinct private research paths are tested against path traversal/public review publication. Browser checks verified the separate Time split menu, invalid-total blocking, suggested preset, successful save confirmation and saved card percentages. Phone width 390px has no horizontal overflow; all five inputs remain in view. Existing admin access remains required.

25 Oct recovery verification: all 23 unit tests now pass in the independent Windows runner, including the real long-path/dirty-worktree test. Fixed fixture line-ending isolation and canonical Windows path return values. Vite build passes. Actual Drivenix and Sikhi Khoj working copies were created successfully under the short local root and both report a clean Git status. Old partial worktrees and source checkout edits were preserved. Duplicate daily-research creation was reproduced as a stalled client request; idle scheduling now reads before creating, with a regression test. Explicit retries use fresh identities to preserve failed attempts. A verify result lets the independent runner execute fixed quality checks when the AI sandbox cannot spawn them; unresolved product issues still block. Application-native SQLite/InputSystem setup and a full overnight recovery trial remain to be verified.
# Controlled Unity verification — 2026-10-25

Implementation evidence in this worktree: four Unity guard tests pass with
`node --test --test-isolation=none tests/unity.test.mjs`. They cover exact release
matching (including patch/suffix), refusal before import on mismatch, byte-for-byte
preservation of dirty source/untracked files/binary `.meta` contents despite
simulated importer changes, zero-exit compiler errors, cleanup with retained logs,
and rejection of nested destinations and linked source trees. These are filesystem
and mocked-editor tests, not real app or device tests. Syntax and `git diff --check`
pass. A first copy implementation using native `fs.cp` stalled in this sandbox;
the final implementation uses exclusive streaming copies and the same tests finish.

Required Node checks were attempted: `npm.cmd test` cannot spawn isolated test
processes (`EPERM`). The final full suite with test isolation disabled passed
26/27 tests; the existing real Git integration test cannot spawn Git
(`spawnSync git EPERM`). All four Unity tests pass.
PowerShell's npm script wrapper is disabled, so commands use `npm.cmd` without
changing execution policy. Dependency installation was interrupted after stalling;
an offline rebuild without scripts then restored the command shims successfully.
Both `npm.cmd run build` and the direct Vite entry reach esbuild and fail with
`spawn EPERM`. A clean dependency install, full `npm test` and `npm run build`
remain mandatory in the independent runner; no build success is claimed.

Real editor attempt (separate from mocks): the installed
`C:\Program Files\Unity\Hub\Editor\6000.0.66f2\Editor\Unity.exe -version`
returned exactly `6000.0.66f2`. A fresh minimal project with that ProjectVersion,
an empty package manifest and one C# source file was started using hidden
`-batchmode -nographics -quit -projectPath ... -logFile ...` execution with a
45-second upper bound. Unity started but exited 1 after its Package Manager could
not connect to the local IPC server after 30 seconds. The log is retained at
ignored `.local/unity-real/editor.log`. No successful compilation, application
verification, EditMode/PlayMode or device testing is claimed. No real app checkout
outside the approved worktree was touched. Licensing/security settings were not
changed. This IPC failure must be retried in the normal worker environment; its
precise cause is unconfirmed, while Node child-process permission failures are
explicit. The independent runner must also verify the configured real app with
its exact editor and required app checks before accepting editor verification.
Independent follow-up on 25 October 2026:
- A clean locked dependency installation completed; all 27 tests pass, including the real Windows Git test, and the production build passes.
- Retried the isolated real-editor helper with Unity 6000.0.66f2 outside the AI sandbox. The editor refused to compile because its licensing client reported no valid license (exit 198). This does not prove a compilation pass. The opt-in Unity configuration remains disabled on real projects until their matching editor is verified.
- Source-preservation and exact-version behavior pass automated tests. No phone/device or gameplay validation is claimed.

## 25 October 2026 - completed work versus review work

- Today and new daily reports now list only `done` results under Completed today and list today's `review` results separately under Ready for review today.
- Review stays with the worker; it does not create an owner question. Existing explicit requests for decisions, information or access are unchanged.
- Both groups retain IST timestamps and use the existing dark styles and phone-stacking layout; no Firebase access or scheduling policy changed.
- Focused presentation tests: 5/5 pass with `node --test --experimental-test-isolation=none tests/presentation.test.mjs`, including review-only and mixed days and IST midnight exclusion.
- Full suite using that in-process test option: 28/29 pass; the real Git worktree test cannot spawn Git (`EPERM`). Configured `npm.cmd test` cannot spawn any test subprocess (`EPERM`).
- Build attempted via `npm.cmd run build` (initially no installed Vite) and direct Vite after offline dependency extraction: esbuild cannot spawn (`EPERM`). No production build success or browser visual verification claimed; independent runner must run the configured tests and build.
- JavaScript syntax checks and `git diff --check` pass. Changes remain uncommitted; nothing was pushed, merged, deployed or published.
- Offline dependency installation was stopped after extracting Vite; installation completion is not claimed, so the independent runner should start with a clean locked install.
Independent verification on 25 October: a clean locked dependency install completed, all 29 tests passed (including real Windows Git checkout), and the production build passed. No new browser visual test was performed for this text/grouping change.


## 2026-10-25 18:31 IST ? Fresh-checkout verification copies

Implemented a separate disposable Unity source root: Windows uses
`LOCALAPPDATA/bcc/u` (user AppData/Local fallback), other platforms use the OS
temporary folder's `bcc/u`, and optional `unity.copyRoot` accepts an absolute
override. Each import gets a unique short directory. Editor logs remain under
`.local/unity-verification/` and survive success/failure cleanup. Lexical and
resolved-path guards reject source-contained roots and overlapping log roots,
including junction aliases. Exact editor matching remains unchanged. No global
Git, registry or real-project Unity configuration was changed. The ignored local
configuration is outside this task's scope; example Node checks now run `npm ci`
before tests/build, and README documents this requirement for fresh checkouts
and disposable Unity copies.

Validation in this restricted Windows session:

- Focused Unity suite: 7/7 pass, including Windows root selection/fallback,
  override rejection, exact editor matching, dirty source/untracked/binary meta
  preservation, compiler-failure cleanup with retained logs, alias rejection,
  and repeat disposal preserving unrelated files in the copy root.
- Full suite with `node --test --test-isolation=none tests/*.test.mjs`: 31/32
  pass; the real Git integration fixture fails at `git init` with `spawnSync git
  EPERM` before its assertions. Standard `npm.cmd test` cannot spawn test
  subprocesses (`EPERM`).
- Clean locked installation was attempted with `npm.cmd ci --no-audit
  --no-fund` and then bounded offline retries. Installation stalled; the final
  retry's log stopped at cached package reads and was interrupted. Installation
  completion is not claimed; ignored node_modules is incomplete.
- `npm.cmd run build` was attempted and fails because Vite is not installed.
  This is an additional dependency-install blocker, not proven to be a sandbox
  process-permission failure, so the task is blocked rather than verify.
- JavaScript syntax checks and `git diff --check` pass.

Next: the orchestrator must complete a clean locked `npm ci`, run `npm test`
and `npm run build` in its normal environment, and retain the real-project
Unity opt-in as disabled until matching-editor validation succeeds. No owner
decision is needed. All task changes remain uncommitted; nothing was pushed,
merged, released or published.
Independent runner: a clean dependency install, all 32 tests, and the production build pass. A real minimal source copy imported and compiled successfully with exact Unity 6000.3.26f1, with its editor log retained outside the disposable copy. Immediate cleanup encountered a temporary Windows directory lock; bounded cleanup retries were added. No device tests claimed.

## 2026-10-26 � Earlier context for private research

- Prompt construction now loads prior research only after a private research task is claimed/prepared, immediately before execution (including resume). Idle ticks, public research and implementation do not read this context.
- Firestore lookup is restricted to the same project, research kind and review/done statuses, ordered by updatedAt descending and document ID ascending, with at most 12 candidates. The prompt includes at most 3 records and 12,000 characters, with bounded individual excerpts and explicit untrusted-reference boundaries. Only researchBody and its update time enter the reference; task metadata, result summaries and unrelated projects are excluded. Credential-like and email-containing bodies are omitted conservatively.
- Empty and failed lookups give explicit limitations without exposing service errors. The composite index definition is included in firestore.indexes.json; it has not been deployed or verified against a live service. Missing index/access falls back safely to unavailable context.
- Private raw event/stderr logs omit content to avoid persisting echoed reference text. Context is passed on stdin only; no dashboard source or public PR body receives the reference. The worker is instructed not to reproduce historical reference text in task results.
- Checks: all 7 research tests pass; the full in-process Node suite has 35 passing tests and one sandbox-blocked Git subprocess test (spawnSync git EPERM). Standard npm test is blocked by test-runner child-process spawn EPERM. Vite build was attempted through its installed Node entry point and is blocked by esbuild spawn EPERM. Worker/research syntax checks and git diff --check pass. Independent configured checks remain required outside this sandbox.
- Scheduling, pause, quota, report and public review policies are unchanged. No service deployment, publication, push or commit was performed.
Independent verification on 26 October: clean locked dependency installation, all 36 Node tests and production build pass. Live Firestore index deployment and same-project context lookup are being verified separately; no claim of native/device testing.
