# BCC handover

Snapshot: 27 October 2026. All workers, reports and supervisor automation are paused. Do not resume them without an explicit command.

## Location and repository

- Folder: Desktop/BFG_Projects/BCC.
- GitHub: https://github.com/brainforgegames/brainforge-command-center
- Dashboard: https://brainforgegames.github.io/brainforge-command-center/
- The old workspace outputs/bcc location is a compatibility junction to this folder; it is not a second copy.

## What is finished

- Dark dashboard, project pages, count drilldowns, browser Back/Forward support, Screenshots and illustrated Ideas pages.
- Analytics UI and scheduled-worker usage collection. The collector does NOT cover this supervisor chat or extra review agents, so it is not an account-wide usage meter.
- Five-column work board: To do, In progress, Blockers, In review, Done (PR28).
- Offline queue and worker alert/context fixes (PR25–29). These exist but do not authorize restarting automation.

## Current limitations

- Latest direct check on 27 October: website HTTP 200; Firestore returned HTTP 429 RESOURCE_EXHAUSTED, Quota exceeded. Live data may be stale. Do not infer that the database recovered from the website loading.
- Saved work and paused state are in .local/offline-queue.json, .local/owner-stop.json and local checkpoints. These private ignored files are not GitHub backups. Never upload worker.config.json or private runtime records.
- The owner stopped continuous automation because overhead and usage were too high. The new preference is direct project commands and a simple daily record when requested. No new BCC features are assigned by this handover.

## Useful entry points

- src/: dashboard; orchestrator/: legacy runtime; tests/: existing checks.
- npm run dev: local preview. npm run build: production build. npm test: tests when relevant.
- GitHub Pages uses a manually dispatched workflow. Do not deploy unless the owner's current task calls for publication.
- OWNER_INSTRUCTIONS.md records dated owner preferences; its newest command-only override supersedes historical always-working requirements.

## Manual records update (27 October)

- Dashboard navigation now keeps Today, Projects, Analytics, Work board, Reports and Ideas. Retired automation pages return to Today.
- Today and Reports describe command-only work and records on request. Existing records are preserved.
- Analytics shows tokens in millions throughout; historical collector data does not automatically include manual chats.

- Analytics now displays tokens only; work-time and completed-task metrics are removed from its controls, totals and details.
