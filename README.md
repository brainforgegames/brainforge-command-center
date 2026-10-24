# Brainforge Command Center

A responsive, single-admin workspace for Sikhi Khoj, Drivenix and Reflex Trainer. The public GitHub Pages frontend keeps workspace records in Firebase Auth/Firestore. Public code is separate from private workspace data.

## Stage 1: dashboard and Firebase

The interface includes project time weights, approved tasks with acceptance criteria and status, feedback with conversation links, global/project instructions, daily reports, worker state, and quota windows. Without Firebase environment variables, it runs an explicitly labelled browser-local demo. A configured build requires the admin Google account; it does not fall back to demo on an authentication failure.

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

Copy `orchestrator/worker.config.example.json` to `worker.config.json`. It starts disabled. Set local clone paths, confirm the correct repositories and base branches, and provide meaningful check command arrays per project (for example `["npm", "test"]` and `["npm", "run", "build"]` for a project that defines those scripts). On Windows the runner resolves npm through Node rather than a command shell. Both local `enabled` and dashboard `workerEnabled` must be true before development runs.

`credentialMode: "firebase-cli"` reuses the existing Firebase CLI login as `brainforgegames@gmail.com` in memory. It creates no service-account key. The Firebase CLI dependency is pinned by the lockfile because this adapter uses its internal token-refresh interface. `adc` is supported for separately configured Google Application Default Credentials. The Firestore adapter uses the authentication library belonging to its transport to avoid incompatible header formats.

The Codex executable must be on PATH or configured with its absolute path. Codex must be authenticated using ChatGPT. Worker execution forces ChatGPT authentication, uses the OpenAI provider with workspace-write restrictions, disables inherited user configuration, removes API-key billing variables, and never switches models to bypass limits. Model choice remains the CLI default. No paid API fallback, credit purchase, or earned-reset consumption is implemented.

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

## Reports and retention

Reports are created at the first scheduler tick at or after **22:00 Asia/Kolkata**, without an AI call, using task status, blockers and review evidence. They are idempotent by IST date. Development can continue after the report until the 23:00 pause. If the laptop is offline, reporting/cleanup resumes when it is available; a local scheduler cannot guarantee a wall-clock delivery while offline.

Reports expire after 30 days and the dashboard hides them immediately at expiry. The reporting task deletes expired Firestore report documents on its next online tick. Server TTL is deliberately not enabled because it can require billed Firestore features. Therefore physical deletion while the laptop remains offline is not guaranteed. Projects, tasks, feedback and instructions do not expire.

## Chat feedback

Discuss feedback in chat first, then capture the agreed outcome in Feedback, optionally linking the conversation. This version does not automatically ingest ChatGPT conversations or treat a chat link as approval. Create an approved task with acceptance criteria when the outcome is ready for work. A future supported chat bridge must preserve that explicit approval step.

## GitHub workflow and current boundaries

All BCC development and deployments use `brainforgegames`. The GitHub connector available in the original setup belonged to another account, so authenticated local `gh` is used. Public Pages publication is explicitly approved; workspace data remains protected by Firebase. Future app-store releases and PR merges remain user-controlled.

CI runs policy tests, Firestore rules tests against a disposable emulator, and the production build. Pages publishing is manual through the `Publish BCC dashboard` workflow. Firebase values are configured as GitHub repository variables, not embedded credentials. Initial implementation is reviewed on its feature branch; the manual deployment can use that branch.

Sikhi Khoj includes both `Sikhi_Khoj` (Unity app) and `sikhi-khoj-app` (website), with local clones and separate checks. Initial bounded tasks cover a website quality audit and Windows native test setup. Drivenix/Reflex Trainer source repositories still need their local clones and mappings. The full interruption/resumption/PR lifecycle is under validation. An older Brainforge pipeline scheduler was found **disabled** and remains untouched. Do not enable both schedulers for the same work.

References: [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode), [App Server quota protocol](https://learn.chatgpt.com/docs/app-server), [Firestore security rules](https://firebase.google.com/docs/firestore/security/get-started), [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).


