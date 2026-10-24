# Validation record

Validated on Windows 11 Home, Intel i7-13620H (10 cores / 16 threads), 32 GB RAM; Node 24.20.0 and Codex CLI 0.163.0-alpha.11. Approximately 233 GB disk space was free at inspection.

- Eight domain/policy tests pass: IST pause boundaries, reporting date/deduplication, weighted time allocation without starvation, disabled/unapproved/blocked task exclusion, quota windows and reset selection, and report expiry.
- Three Firestore emulator integration tests pass with Firebase CLI 15.33.0: unauthenticated and wrong-account isolation, admin-only task control, denied admin-identity/report/worker spoofing, and invalid document rejection.
- Production Vite build passes with configured Firebase values. Local browser checks verified task creation/persistence in demo mode and the configured admin sign-in gate. Phone-width (390px) navigation opens and document width remains 390px.
- Firebase project, web app, Google provider, owner identity and admin UID mapping are provisioned. Rules deployed successfully; Firestore seeding is create-only and was verified. A paused worker connected to the live database. Billing API confirmed `billingEnabled: false` and no billing account attached.
- The read-only Codex quota probe returned real short and weekly window values. These are account-wide snapshots, not per-task usage estimates.

Not yet validated: a human Google sign-in on the published site, a real AI task/checkpoint/resume/PR lifecycle, actual quota exhaustion/reset over time, a 22:00 scheduled report, or a 23:00 interruption observed at wall-clock time. Those boundaries have deterministic policy tests, not a completed overnight production trial. Repository mapping and transfer are pending; development stays disabled.

The existing disabled `Brainforge Development Pipeline` Windows task was not modified.
