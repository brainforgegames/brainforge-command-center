// Only an exhausted queue may create this delay. Active checkpoints always bypass it.
export const IDLE_POLL_MS = 5 * 60 * 1000;
export function idleWaiting(checkpoint, now = Date.now()) {
  const until = checkpoint.idleRetryAt;
  return !checkpoint.task && !checkpoint.analyticsActive && Number.isFinite(until)
    && until > now && until <= now + IDLE_POLL_MS;
}
export function markQueueIdle(checkpoint, now = Date.now()) {
  checkpoint.idleRetryAt = checkpoint.task ? 0 : now + IDLE_POLL_MS;
}
