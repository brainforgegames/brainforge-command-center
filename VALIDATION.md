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

## 2026-10-26 — Earlier context for private research

- Prompt construction now loads prior research only after a private research task is claimed/prepared, immediately before execution (including resume). Idle ticks, public research and implementation do not read this context.
- Firestore lookup is restricted to the same project, research kind and review/done statuses, ordered by updatedAt descending and document ID ascending, with at most 12 candidates. The prompt includes at most 3 records and 12,000 characters, with bounded individual excerpts and explicit untrusted-reference boundaries. Only researchBody and its update time enter the reference; task metadata, result summaries and unrelated projects are excluded. Credential-like and email-containing bodies are omitted conservatively.
- Empty and failed lookups give explicit limitations without exposing service errors. The composite index definition is included in firestore.indexes.json; it has not been deployed or verified against a live service. Missing index/access falls back safely to unavailable context.
- Private raw event/stderr logs omit content to avoid persisting echoed reference text. Context is passed on stdin only; no dashboard source or public PR body receives the reference. The worker is instructed not to reproduce historical reference text in task results.
- Checks: all 7 research tests pass; the full in-process Node suite has 35 passing tests and one sandbox-blocked Git subprocess test (spawnSync git EPERM). Standard npm test is blocked by test-runner child-process spawn EPERM. Vite build was attempted through its installed Node entry point and is blocked by esbuild spawn EPERM. Worker/research syntax checks and git diff --check pass. Independent configured checks remain required outside this sandbox.
- Scheduling, pause, quota, report and public review policies are unchanged. No service deployment, publication, push or commit was performed.
Independent verification on 26 October: clean locked dependency installation, all 36 Node tests and production build pass. Live Firestore index deployment and same-project context lookup are being verified separately; no claim of native/device testing.
Independent normal runner on 26 October: clean locked dependency installation, all 39 tests and production build pass. Evidence serialization retains only allowlisted exit/state/category values; private outputs and paths are not copied into the new evidence records.

Private screenshot gallery validation (26 October 2026): 45 Node tests passed; production build passed; Firestore emulator access suite passed all 5 tests, including anonymous/non-admin denial and admin read-only access to both metadata and image documents. No actual captures were uploaded by this change. Gallery visual review with real captures remains an integration check. Public assets contain no screenshots. Firebase rules must be deployed with the frontend change.

Two-worker runtime source validation (26 October 2026): 48 Node tests passed, including seven new coordination/ownership/control/lock cases; production build passed; real Firestore emulator concurrency plus existing rules suite passed all 5 tests. Syntax checks for worker/installer and Python launcher passed. No live database, scheduler, config or worker process was changed. Activation requires reviewed migration, preserved legacy checkpoint and a live two-process smoke check. Claims deliberately fail closed after unaccounted crash reservations.

Visual idea library validation (26 October 2026): 48 Node tests passed, including schema bounds, escaping, semantic cards/dialogs and two distinct SVG states per mechanic. Production build passed. All 6 Firestore emulator access tests passed, including admin-only proposal reads and denied client writes. Actual proposal data was not seeded or published. DEV-only samples are synthetic. Browser automation was unavailable (empty browser inventory); desktop/mobile visual review, keyboard focus return and native dialog behaviour remain integration checks. Isolated sample server: http://127.0.0.1:5191/?sample=1.

## 2026-10-27 01:00 IST - Browser Back and Forward navigation

- Added GitHub Pages-compatible hash routes for all existing pages, work filters/project drilldowns, and screenshot project filters. Initial and refreshed deep links restore the view; unknown routes replace the current entry with Today.
- Only explicit navigation pushes history. Repeated destinations, render/live updates and authentication callbacks do not add entries. Initial routing uses replacement rather than a Back-trapping sentinel. Existing pathname/query (including preview mode) are preserved.
- Navigation clears transient dialogs and screenshot bytes, invalidates pending screenshot requests, closes the mobile menu, and retains the existing private-data gate. Route URLs contain only page/filter identifiers. Page changes focus the heading; filter changes retain keyboard focus.
- New navigation tests cover all pages, deep links/refresh, filtered Back/Forward, paired browser events, manual hash changes, malformed routes, duplicate suppression, and leaving the first entry.
- Checks: five navigation tests pass with `node --test --test-isolation=none tests/navigation.test.mjs`; full in-process suite: 65 pass, one blocked by `spawnSync git EPERM`. Standard test invocation is blocked by child-process `spawn EPERM`. Direct Vite build is blocked by esbuild `spawn EPERM`. JavaScript syntax checks and `git diff --check` pass.
- Dependency installation was attempted; no clean install completion is claimed. Orchestrator must run its configured clean install, tests and build outside these sandbox process restrictions. No browser visual smoke check is claimed. Changes remain uncommitted; nothing was pushed, merged, deployed or published.
## 2026-10-27 — Worker analytics source implementation

- Added Analytics navigation, hourly Today and daily 7/30-day IST charts, project worker-time ranking/share, completed-task comparison, token coverage, project token values and keyboard-accessible chart/table values. Mobile chart bars scroll horizontally with minimum 32px width; dark styling follows the dashboard. Loading, access failure, missing history, partial collection and empty recorded periods have separate copy.
- Inspected numeric usage fields and event types in actual local worker logs and compared a terminal usage object with its matching rollout's cumulative token totals. No event content, identifiers, credentials or actual private usage records were copied into source. Resume baselines are subtracted; duplicate terminal totals and repeated database writes cannot inflate consumption. Missing baselines/counter resets remain unavailable.
- New transaction-backed daily aggregates persist independently of report cleanup. Worker process start/close timestamps measure run time; daily pause time is removed and parallel lanes add independently. Local checkpoints preserve pending upload/recovery measurements. Hard interruption recovery records only the observed portion and marks unknown remainder unavailable. Claims, project shares, pause/quota policy and scheduling reservations are preserved.
- Completion recording requires the trusted supervisor's explicit verified-completion command after review and passing evidence. It atomically writes a completion timestamp and distinct-task count. Report archival consumes only explicit verified timestamps; it never substitutes updatedAt or counts review drafts. Historical status-only completions remain unavailable. This handoff is documented in README; the helper was not run against live tasks.
- `npm.cmd ci --ignore-scripts --offline` succeeded (locked dependencies; no dependency version changes). Eight focused analytics tests pass with `node --test --test-isolation=none tests/analytics.test.mjs`, covering IST boundaries, daily pause exclusion, parallel contributions, retry deduplication/privacy, resume deltas, unavailable usage, verified completion dates, report retention, malformed aggregates and honest empty/loading/error markup.
- Full in-process suite: 68 passed, one Git subprocess test blocked by `spawnSync git EPERM` (69 total). Normal test runner cannot spawn its test subprocesses (`spawn EPERM`). The configured production build also fails at esbuild process creation with `spawn EPERM`; this is not a successful build.
- Firestore emulator access/concurrency suite could not start because Node cannot spawn `java -version`; Java 21 is installed and responds when invoked directly. Added private/read-only aggregate access tests and a real emulator transaction test for parallel run retries and distinct completion transitions, included in `npm run test:rules`; these require independent execution outside the sandbox. Syntax checks and `git diff --check` pass.
- Computer-use browser inventory is empty, so desktop/mobile visual and live keyboard interaction checks remain for the unrestricted runner. No live records/configuration, workers, scheduler, credentials, rules or hosting changed. Nothing committed, pushed, merged, deployed or published. Next: independent configured checks and browser smoke test, then the existing orchestrator release/handoff workflow; do not infer historic metrics or auto-complete drafts.

## 26 October 2026, 19:02 IST ? owner reference design pass

- Inspected all eight actual owner PNGs in Downloads, from 02_58_23 PM through 02_59_04 PM using image viewing.
- Added a final design stylesheet for black/navy surfaces, blue selection states, restrained borders, consistent spacing, readable type, responsive cards and visible keyboard focus; added decorative SVG line icons and reference-style BCC branding.
- Kept existing data sources and page actions. Added no sample records, people, percentages, schedules or purchases. Time shares now appear only in Time split; Projects retain priority ordering. Today retains separate paused counts, completed-only finished results and paused-project next-step exclusion. Screenshot handlers are unchanged.
- Passed JavaScript syntax check and git diff whitespace check. All 18 focused existing tests passed with `node --test --test-isolation=none tests/presentation.test.mjs tests/reading.test.mjs tests/previews.test.mjs tests/allocation.test.mjs tests/ideas.test.mjs`.
- Default test runner could not spawn workers (`spawn EPERM`). Direct Vite production build and preview server both failed when esbuild tried to spawn (`spawn EPERM`). No browser surfaces were available through browser inventory. Consequently production build and desktop/mobile visual inspection remain unverified; orchestrator must complete those checks in its configured environment.
- Dependency installation did not finish; interrupted it after dependencies needed to identify the build permission error were present. No dependency manifest or lockfile changes. No deployment, commit, push or PR performed. Source changes are left uncommitted.

## 26 October 2026 - design recovery visual-check attempt

- Preserved the prepared design and inspected all eight actual owner PNGs again with image viewing, including the Projects, Tasks, Workers, Reports, Analytics, Automations and Settings references. No additional product changes were made during recovery.
- Supervisor reports that npm ci and npm run build completed successfully in this exact worktree and Core57 tests passed on the host. These supersede the earlier dependency/build blocker above; no repeated install or full test cycle was run.
- Current JavaScript syntax checks for src/main.js and src/icons.js and git diff --check pass.
- Desktop/mobile visual inspection remains blocked: cua.getState returned no browsers or apps, and an explicit attempt to create an in-app browser tab for the local preview returned "Browser is not available: iab". No rendered viewport was available, so no desktop/mobile layout or overflow pass is claimed.
- Exact next prerequisite: the orchestrator must provide a browser-enabled review session and inspect the prepared design at desktop and phone widths, checking navigation, cards, text wrapping, horizontal overflow, Time split and screenshot focus/Escape behavior. Correct any observed layout issue before accepting the design.
- Source and validation changes remain uncommitted. Nothing was pushed, merged, deployed or published. No owner decision is needed; this is a worker tooling prerequisite.

## 26 October 2026, 22:56 IST - recovery browser access evidence

- Viewed all eight actual owner reference PNGs again; preserved the prepared source design without further product edits.
- Supervisor-provided successful locked install, production build and Core57 host tests remain the build/test evidence; no repeated installation or full test cycle was run.
- Current src/main.js and src/icons.js syntax checks and git diff --check pass.
- Browser surface inventory still returns no apps or browsers. Tried the installed Windows computer-use skill as an actionable fallback: sky.list_apps found a running Chrome window titled Brainforge Command Center, but sky.get_window/get_window_state was rejected with "Computer Use was not approved to use Google Chrome". No dashboard screenshot or rendered viewport was obtained.
- Desktop/mobile visual acceptance remains incomplete. Exact unblock action: run a browser-enabled review of this worktree at desktop and phone widths, inspect each existing page for wrapping/overflow and navigation, confirm Projects and Time split separation and screenshot keyboard behavior, and correct any visible issue. This is tooling access for the worker, not an owner product decision.
- No product edits, commits, pushes, PRs, deployment or publication in this recovery attempt. Prepared changes remain uncommitted.

## 27 October 2026, 00:12 IST - assigned design recovery

- Re-inspected all eight owner PNGs with image viewing; preserved the prepared design and existing uncommitted source files.
- Current browser inventory is empty for both apps and browsers. Attempting a local review tab through Chrome returned "Browser is not available: chrome". Desktop/mobile rendered inspection remains incomplete; no visual acceptance is claimed.
- JavaScript syntax checks for src/main.js and src/icons.js and git diff --check pass. One npm.cmd run build attempt reached installed Vite but was blocked by esbuild spawn EPERM. Supervisor-reported successful host build and Core57 tests remain valid separate evidence; no dependency reinstall or repeated test cycle was performed.
- Required unblock: provide an enabled browser surface for local desktop/mobile inspection, then check wrapping, overflow, navigation, page separation and screenshot keyboard behavior and fix visible issues. This requires worker tooling access, not an owner decision. Changes remain uncommitted and unpublished.

## 27 October 2026 - supervisor visual review
- Opened the real local preview in the in-app browser. Inspected Today and Projects on the desktop and Today in a 390px phone frame with sample data clearly labeled.
- Increased result bullets, project descriptions and navigation text for owner readability. Phone hero and text wrap inside the narrow viewport.
- Host production build and 57 tests passed before this typography-only adjustment. Full page-by-page interaction acceptance remains pending; this is a prepared design, not a published release.

## 27 October 2026 supervisor release checks
- Integrated current main design without changing its navigation styling; Analytics has its own chart icon and optional collection details.
- Host npm test: 69 passed. Production build passed. Firestore emulator integration: 9 passed including private access, deduplication and concurrent writes.
- Browser smoke checks: Analytics opens; Today, 7-day and 30-day selection and time/token/completed views respond; narrow layout inspected. No historic data invented.

- Checked a 390px phone fixture with clearly labelled fictional values; stacked narrow-screen Analytics selectors so date labels remain readable.

## 27 October 2026 - browser navigation integration
- Merged current main into the existing browser-history change, preserving the released design and clean Analytics layout. Resolved the validation-log conflict by keeping both records.
- Added Analytics to the route map so opening it does not incorrectly return to Today; its refresh and Back/Forward traversal have focused regression coverage.
- Host full suite passed (74 tests before the added Analytics traversal check); production build passed. Focused navigation suite passed after that addition. No Firestore data or worker runtime modified.
