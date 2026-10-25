# Brainforge Command Center

A responsive, single-admin workspace for Sikhi Khoj, Drivenix, Reflex Trainer, Brainforge Games company improvements and BCC Improvements. The public GitHub Pages frontend keeps workspace records in Firebase Auth/Firestore. Public code is separate from private workspace data.

## Stage 1: dashboard and Firebase

The dark interface centers on Today, project cards, a dedicated Time split screen, a filterable work board, specific owner questions, readable daily reports and work controls. Progress, issues and next steps use short owner-facing summaries; internal acceptance criteria, diagnostics and checks are collapsed. Feedback and instructions come through chat. Internal scheduling weights and stored instructions remain available to the worker. Without Firebase environment variables, it runs an explicitly labelled browser-local demo. A configured build requires the admin Google account; it does not fall back to demo on an authentication failure.

Firebase project: `brainforge-bcc-2026`. Google sign-in is enabled. Owner: `brainforgegames@gmail.com`, Auth UID `brainforge-admin`. Firestore region: `asia-south1`. Billing is disabled and no billing account is attached. The web configuration is public configuration, not an authorization mechanism; Firestore rules enforce access against the server-managed `config/admin` document. Browser clients cannot change that document or forge reports/worker telemetry.

```powershell
npm ci
npm run dev
npm test
npm run test:rules
npm run build
```

Copy `.env.example` to `.env.local` for a configured build. Never put service-account keys, Google refresh tokens, signing keys or project source in the public repository. `.env.local`, runtime state and `worker.config.json` are ignored. Firebase rules are deployed separately from the static frontend.

## Stage 2: local Windows worker

Copy `orchestrator/worker.config.example.json` to `worker.config.json`. It starts disabled. Set local clone paths, confirm the correct repositories and base branches, and provide meaningful check command arrays per project (for example `["npm", "ci"]`, `["npm", "test"]` and `["npm", "run", "build"]` for a project that defines those scripts). On Windows the runner resolves npm through Node rather than a command shell. Both local `enabled` and dashboard `workerEnabled` must be true before development runs.

`credentialMode: "firebase-cli"` reuses the existing Firebase CLI login as `brainforgegames@gmail.com` in memory. It creates no service-account key. The Firebase CLI dependency is pinned by the lockfile because this adapter uses its internal token-refresh interface. `adc` is supported for separately configured Google Application Default Credentials. The Firestore adapter uses the authentication library belonging to its transport to avoid incompatible header formats.

The Codex executable must be on PATH or configured with its absolute path. Codex must be authenticated using ChatGPT. Worker execution forces ChatGPT authentication, uses the OpenAI provider with workspace-write restrictions, retains Windows sandbox configuration while overriding authentication/provider settings and removing inherited desktop session bridge variables, removes API-key billing variables, and never switches models to bypass limits. Model choice remains the CLI default. No paid API fallback, credit purchase, or earned-reset consumption is implemented.

```powershell
npm run worker:plan
npm run worker:once
node scripts/install-worker.mjs
# Remove the two BCC scheduled tasks:
node scripts/install-worker.mjs --uninstall
```

The installer creates separate current-user scheduled tasks for development and reporting, checked every minute. Development has an exclusive local lock. Reports do not wait for an active AI run or a quota reset. Windows must be awake and the user signed in. This does not shut down the laptop, wake a powered-off machine, or run before login.

Projects receive relative shares of **elapsed worker time** through weighted least-served scheduling. Equal weights are the initial default. A zero weight or disabled project receives no new work. Only approved queued tasks are eligible; blocked tasks are skipped. Sikhi Khoj tasks explicitly target the Unity app or website, with separate repository mappings and check commands. Equal-priority tasks prefer the less-served repository within their project. Each run uses a dedicated Git worktree and `bcc/task-*` branch. Runs checkpoint their task, Codex session, elapsed service time and retry deadline locally. A time slice is at most 25 minutes by default and is cut off at 23:00 IST. Development remains paused until midnight. A remote pause is checked during inference every 15 seconds and before checks. Working files survive interruption.

The read-only Codex App Server `account/rateLimits/read` probe reports the available short and weekly windows. Exhaustion waits for the latest exhausted window reset plus one minute. Missing data is shown as unavailable. If a run reports a limit without a machine-readable reset, the checkpoint waits one hour before another probe; a known exhausted window can extend that wait. No quota-reset credit is consumed. Execution JSONL records are local and retained for 30 days; token events are not presented as quota percentages.

The worker expects a structured result, runs configured checks itself, and sends completion to **review**, never automatically to done. `publishPullRequests` is false until configured; when enabled, the orchestrator commits, pushes and opens a draft PR after checks. It never merges, releases or submits to app stores. Local worktrees should be reviewed for credentials and generated artifacts before enabling automatic pushes. A stale lock after an abnormal process termination requires checking that no worker/child process remains before removing `.local/worker.lock`; automatic crash recovery is not yet validated.

### Windows worktree paths

New Windows task worktrees default to `%LOCALAPPDATA%\bcc\w` with a short hash of the repository path and full task ID. If `LOCALAPPDATA` is unavailable, the worker uses the current user's `AppData\Local` folder. Other platforms retain the `.local/worktrees` root. Set the optional `worktreeRoot` in ignored `worker.config.json` to an absolute writable folder on a local drive for an even shorter location. Leave it empty for the default; no personal filesystem path belongs in the example configuration. Do not point multiple worker installations at the same repository concurrently.

Preparation first reuses the checkpoint location or the task branch's registered worktree, then preserves legacy `.local/worktrees` locations. Changing the root affects new tasks only. Missing checkpoint folders, conflicting registrations and unregistered partial folders stop preparation with an inspection message; the worker never resets, moves, removes or prunes them. Preserve failed checkouts and inspect their registration, index and user edits before a supervised retry; this change does not repair an already damaged index.

Git commands launched by the Windows worker use command-scoped `core.longpaths=true`, including worktree checkout. This does not change global Git configuration, the registry or Windows security policy. Other tools can still impose their own path limits. Checkpoints, logs and locks remain in the existing `.local` folder.

## Reports and retention

Reports are created at the first scheduler tick at or after **22:00 Asia/Kolkata**, without an AI call, using task status, blockers and review evidence. They are idempotent by IST date. Development can continue after the report until the 23:00 pause. If the laptop is offline, reporting/cleanup resumes when it is available; a local scheduler cannot guarantee a wall-clock delivery while offline.

Reports expire after 30 days and the dashboard hides them immediately at expiry. The reporting task deletes expired Firestore report documents on its next online tick. Server TTL is deliberately not enabled because it can require billed Firestore features. Therefore physical deletion while the laptop remains offline is not guaranteed. Projects, tasks, feedback and instructions do not expire.

## Chat feedback

Discuss feedback in chat first, then capture the agreed outcome in Feedback, optionally linking the conversation. This version does not automatically ingest ChatGPT conversations or treat a chat link as approval. Create an approved task with acceptance criteria when the outcome is ready for work. A future supported chat bridge must preserve that explicit approval step.

## GitHub workflow and current boundaries

All BCC development and deployments use `brainforgegames`. The GitHub connector available in the original setup belonged to another account, so authenticated local `gh` is used. Public Pages publication is explicitly approved; workspace data remains protected by Firebase. Future app-store releases and PR merges remain user-controlled.

CI runs policy tests, Firestore rules tests against a disposable emulator, and the production build. Pages publishing is manual through the `Publish BCC dashboard` workflow. Firebase values are configured as GitHub repository variables, not embedded credentials. Initial implementation is reviewed on its feature branch; the manual deployment can use that branch.

Sikhi Khoj includes both `Sikhi_Khoj` (Unity app) and `sikhi-khoj-app` (website), with local clones and separate checks. Initial bounded tasks cover a website quality audit and Windows native test setup. Drivenix (GitLab) and Reflexer (GitHub collaborator access) are cloned and mapped; their implementation baseline checks remain pending. Idle research is limited to a dated research document and can create a draft review without changing product code. A real website audit completed its check and opened a draft PR; interruption/resumption and overnight behavior remain under validation. An older Brainforge pipeline scheduler was found **disabled** and remains untouched. Do not enable both schedulers for the same work.

References: [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode), [App Server quota protocol](https://learn.chatgpt.com/docs/app-server), [Firestore security rules](https://firebase.google.com/docs/firestore/security/get-started), [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).



## Time split and studio work

Time split lives in its own navigation item (inside the burger menu on phones). Five sliders and numeric inputs choose integer percentages totaling 100. Saving uses one Firestore batch, so a rejected update cannot partially change the split. A 0% project is disabled for new selection. Project cards display saved shares; drafts do not change the worker. Existing equal weights translate to 20% each without resetting stored choices. The optional suggested preset is 30/25/25/10/10 for Sikhi Khoj, Drivenix, Reflex Trainer, company and BCC; it does not apply until saved.

Weights describe a long-term share of elapsed eligible work time, not reserved clock hours. Blocked or empty projects yield to eligible work. The company and BCC research tasks use distinct document paths and private local worktrees; proposals are saved in authenticated Firestore and are never pushed as public research PRs. The company mapping is research-only. BCC implementation tasks retain normal code checks and review publication.

The idle worker checks for an existing dated research task before submitting a create-only write, avoiding stalled duplicate requests in the current REST client. An administrator may increment a task's positive integer attempt to prepare a fresh isolated retry while preserving older folders. The AI can return verify when only sandbox process permissions prevented configured checks; the orchestrator still runs every configured check before review status. Product blockers are not promoted through this path.
# Controlled Unity verification

For a Unity app repository, opt in with `unity` beside its existing `checks` in
the local worker configuration (see the app entry in the example). Set `editor`
to the absolute installed Unity executable path and `timeoutMs` to 1000–900000
milliseconds (default 300000). Leave Unity configuration absent for other repos.
The example's empty editor path must be filled before enabling the app.

The worker reads `ProjectSettings/ProjectVersion.txt` and compares the complete
`m_EditorVersion` with the installed editor's `-version` output before import.
A missing editor or any mismatch blocks verification; it never selects a newer
editor or changes project versions, licensing or security settings.

Unity verification always uses a fresh disposable copy, including current edits,
untracked source, package locks and importer `.meta` files. It excludes generated
`Library`, `Temp`, `Logs`, `obj`, Git state and Node dependencies. Linked source
trees are rejected rather than followed. Unity runs hidden with fixed batch,
headless and quit flags, a timeout and the worker's pause/disable monitoring.
The configured checks then run in this imported copy, so they can consume freshly
generated assemblies. Configure commands relative to that copy; it has no Git
metadata or preinstalled Node dependencies. No arbitrary Unity execute method,
store publication or license command is added.

The copy is removed after checks or failure; editor logs remain under ignored
`.local/unity-verification/` for diagnosis. Only the original task checkout is
eligible for later staging, so import-generated source/metadata and logs never
enter its diff. A successful import/compile is editor evidence, not an EditMode,
PlayMode or device test; keep required test commands in `checks`.


### Fresh-checkout dependencies and Unity copy paths

Run `npm ci` from the committed lockfile before `npm test` and `npm run build`
in every fresh checkout. The example Node check lists run these commands in that
order; keep the same order in ignored local configuration. Do not rely on a
parent checkout's dependencies. Unity copies exclude `node_modules`, so Node
checks in those copies also need a locked install first.

Disposable Unity sources default to `%LOCALAPPDATA%\bcc\u` on Windows, falling
back to the user's `AppData\Local\bcc\u`, and the OS temporary folder's
`bcc/u` elsewhere. Optional `unity.copyRoot` selects an absolute writable short
folder (empty uses the default). Each attempt gets a unique directory; cleanup
removes only that directory. Logs stay in `.local/unity-verification/`, outside
the disposable source, on success and failure. Copy roots inside source or
overlapping log storage, including filesystem aliases, are rejected. No global
Git or registry setting changes. Keep real-project Unity configuration disabled
until the exact installed editor has successfully validated that project.
