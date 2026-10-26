import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
if (process.platform !== "win32")
  throw Error("This installer is for Windows Task Scheduler.");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const remove = process.argv.includes("--uninstall"),
  parallel = process.argv.includes("--parallel"),
  prepareMigration = process.argv.includes("--prepare-migration");
if (prepareMigration && !parallel) throw Error("Migration preparation requires --parallel.");
if (!remove && !existsSync(path.join(root, "worker.config.json")))
  throw Error("Configure worker.config.json first.");
const python = spawnSync(
  "python.exe",
  ["-c", "import sys; print(sys.executable)"],
  { encoding: "utf8", windowsHide: true },
);
if (python.status !== 0)
  throw Error("Python is required for the hidden scheduler launcher.");
const pythonw = path.join(path.dirname(python.stdout.trim()), "pythonw.exe");
if (!existsSync(pythonw)) throw Error("pythonw.exe is unavailable.");
const ps = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const commands = ["$ErrorActionPreference='Stop'"];
for (const entry of (parallel ? ["lane-1", "lane-2"] : ["worker", "report"])) {
  const mode = entry.startsWith("lane-") ? "worker" : entry;
  const name =
    "Brainforge Command Center " + (entry.startsWith("lane-") ? "Worker " + entry : mode === "worker" ? "Worker" : "Reports");
  if (remove) {
    commands.push(
      `Get-ScheduledTask -TaskName ${ps(name)} -ErrorAction SilentlyContinue | Unregister-ScheduledTask -Confirm:$false`,
    );
    continue;
  }
  const args = `"${path.join(root, "scripts/run_scheduled.py")}" --node "${process.execPath}" --mode ${mode}${entry.startsWith("lane-") ? " --lane " + entry : ""}`;
  commands.push(
    `$BccAction=New-ScheduledTaskAction -Execute ${ps(pythonw)} -Argument ${ps(args)} -WorkingDirectory ${ps(root)}`,
  );
  commands.push(
    "$BccTrigger=New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)",
  );
  commands.push(
    `$BccSettings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes ${mode === "worker" ? 60 : 1})`,
  );
  commands.push(
    `Register-ScheduledTask -TaskName ${ps(name)} -Action $BccAction -Trigger $BccTrigger -Settings $BccSettings -Description ${ps(mode === "worker" ? "Approved BCC development; paused until configuration is complete." : "Independent 22:00 IST report and expired report cleanup; no AI calls.")} -Force | Out-Null`,
  );
  if (prepareMigration) commands.push(`Disable-ScheduledTask -TaskName ${ps(name)} | Out-Null`);
}
const result = spawnSync(
  "powershell.exe",
  ["-NoProfile", "-NonInteractive", "-Command", commands.join("; ")],
  { encoding: "utf8", windowsHide: true },
);
if (result.status !== 0)
  throw Error(result.stderr || "Task registration failed.");
console.log(
  remove
    ? "BCC scheduled tasks removed."
    : parallel ? `Two BCC lane jobs registered${prepareMigration ? " disabled for migration" : ""}. Existing single-worker and report jobs were not changed.`
    : "BCC worker and reporting tasks installed for the current user. No Windows script policy was changed.",
);
