import { spawn } from "node:child_process";
export function summarizeQuota(result, now = Date.now()) {
  const buckets = result?.rateLimitsByLimitId
    ? Object.values(result.rateLimitsByLimitId)
    : result?.rateLimits
      ? [result.rateLimits]
      : [];
  const windows = buckets.flatMap((b) =>
    [b.primary, b.secondary]
      .filter(Boolean)
      .map((w) => ({ ...w, limitId: b.limitId || "codex" })),
  );
  const exhausted = windows.filter(
    (w) => w.usedPercent >= 100 && w.resetsAt * 1000 > now,
  );
  return {
    windows,
    usedPercent: windows.length
      ? Math.max(...windows.map((w) => w.usedPercent))
      : null,
    blockedUntil: exhausted.length
      ? Math.max(...exhausted.map((w) => w.resetsAt * 1000)) + 60000
      : 0,
  };
}
export function readQuota(executable = "codex.exe") {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.OPENAI_API_KEY;
    const child = spawn(executable, ["app-server"], {
      env,
      windowsHide: true,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let buffer = "",
      done = false;
    const finish = (error, result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child.stdin.end();
      child.kill();
      error ? reject(error) : resolve(summarizeQuota(result));
    };
    const send = (x) => child.stdin.write(JSON.stringify(x) + "\n");
    const timer = setTimeout(
      () => finish(Error("Quota probe timed out")),
      20000,
    );
    child.on("error", (e) => finish(e));
    child.stderr.resume();
    child.on("exit", () => {
      if (!done) finish(Error("Quota probe exited"));
    });
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      for (const line of lines) {
        let e;
        try {
          e = JSON.parse(line);
        } catch {
          continue;
        }
        if (e.id === 0) {
          if (e.error) return finish(Error("Quota initialization failed"));
          send({ method: "initialized", params: {} });
          send({ id: 1, method: "account/rateLimits/read" });
        }
        if (e.id === 1) {
          if (e.error) return finish(Error("Quota is unavailable"));
          finish(null, e.result);
        }
      }
    });
    send({
      id: 0,
      method: "initialize",
      params: {
        clientInfo: {
          name: "brainforge_bcc",
          title: "Brainforge Command Center",
          version: "0.1.0",
        },
      },
    });
  });
}
