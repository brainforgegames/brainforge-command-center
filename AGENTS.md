# BCC project guidance

Brainforge Command Center is a lightweight dashboard for project records. Its purpose is to help the owner see progress, not to become the main product being developed.

- Keep the existing dark theme, readable type and short plain-language bullets. Technical notes belong in optional Details.
- Keep Projects, Time split, Analytics, Screenshots and Ideas in their own places. Counters should open their matching lists; only verified finished work belongs under finished.
- Do not enable the old orchestration stack, supervisor alerts, scheduled jobs or self-assigning workers. It is paused by explicit owner instruction.
- BCC updates are currently on request; the proposed once-daily record does not authorize an unattended schedule. Preserve local records if the database is unavailable.
- Existing OWNER_INSTRUCTIONS.md contains historical requests. Its old continuous-work/two-worker rules are superseded by the explicit 27 October command-only workflow and these current instructions.

## Working together

- Work on the owner's current explicit task. Use judgment to finish it end to end: inspect relevant files, make the change, fix ordinary errors, run focused checks and report the result. Routine implementation decisions do not need repeated permission.
- Queue unrelated ideas rather than changing direction mid-task. If the task finishes, wait for the next command. No scheduled workers, watchers, recurring reports or autonomous task picking unless the owner specifically enables them again.
- Prefer one focused implementation and an appropriate verification pass. Add tests when they protect meaningful behavior; avoid broad repeated rebuilds, speculative test matrices or extra agents for simple changes.
- Read HANDOVER.md when starting a new chat; check actual Git state before relying on its dated snapshot. Keep the handover concise when completed work changes it.
- Preserve unrelated local edits and unfinished work. Commit only task-owned files; use a suitable branch for feature work. Do not force-push or discard someone else's changes.
- Explain results with short everyday bullets: what changed, what is unfinished, and any real decision needed. Put technical detail after the visible outcome. Drafted, compiled, tested, merged and published mean different things.
- Do not purchase credits, enable billing, expose credentials or publish to app stores without explicit owner instruction. The owner handles Play Store/App Store publication. Follow repository-specific handling rules for private backups.
- The owner's latest instruction takes precedence. These notes are context, not a requirement for extra planning, approval ceremonies or automation.
