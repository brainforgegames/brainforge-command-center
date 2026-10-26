// Retry only positively identified timeouts; product failures need investigation.
export function verificationRetry(evidence, previousAttempts = 0) {
  if (evidence.passed || evidence.category !== "timeout" || !evidence.timedOut) return null;
  if (!Number.isInteger(previousAttempts) || previousAttempts < 0 || previousAttempts >= 3) return null;
  return {attempt: previousAttempts + 1, delayMs: [120000, 300000, 900000][previousAttempts]};
}
