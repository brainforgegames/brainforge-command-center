// Only allowlisted values leave the command boundary. Never persist output,
// exception messages, command arguments, environment values or local paths.
export function verificationEvidence(result = {}, index = 1) {
  const exitCode = Number.isSafeInteger(result.code) ? result.code : null;
  const stopped = result.stopped === true;
  const timedOut = result.timedOut === true;
  const passed = exitCode === 0 && !stopped && !timedOut && !result.errorCode;
  let category = passed ? "none" : "unknown";
  if (!passed) {
    const text = [result.out, result.err].filter((s) => typeof s === "string")
      .map((s) => s.slice(0, 32768)).join("\n");
    const matches = new Set();
    if (timedOut) matches.add("timeout");
    if (["EPERM", "EACCES"].includes(result.errorCode) ||
        /\b(?:EPERM|EACCES)\b|access is denied|permission denied|operation not permitted/i.test(text))
      matches.add("process_access");
    if (result.errorCode === "ENOENT" ||
        /\b(?:MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND)\b|cannot find (?:module|package)|command not found|is not recognized as an internal or external command/i.test(text))
      matches.add("missing_dependency");
    if (/\b(?:AssertionError|ERR_ASSERTION)\b/i.test(text)) matches.add("product_assertion");
    if (matches.size === 1) category = [...matches][0];
    else if (matches.size > 1) category = "mixed";
    else if (stopped) category = "stopped";
  }
  return {
    command: `Quality check ${Number.isSafeInteger(index) && index > 0 ? index : 1}`,
    passed, exitCode, stopped, timedOut, category,
  };
}

export async function runVerification(run, index) {
  try {
    return verificationEvidence(await run(), index);
  } catch (error) {
    return verificationEvidence({ errorCode: error?.code }, index);
  }
}

export function verificationIssue(evidence) {
  const hints = {
    timeout: "The check reached its time limit.",
    stopped: "The check was stopped before it finished.",
    process_access: "The check reported a possible process access restriction.",
    missing_dependency: "The check reported a possible missing tool or dependency.",
    product_assertion: "The check reported an assertion failure that needs investigation.",
    mixed: "The check reported more than one kind of error; the cause needs investigation.",
    unknown: "The check failed, but the cause could not be determined safely.",
  };
  return hints[evidence.category] || hints.unknown;
}
