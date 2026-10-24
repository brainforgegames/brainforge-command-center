# Validation record

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
