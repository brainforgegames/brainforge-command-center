"""Run BCC without opening console windows; preserve bounded local logs."""
import argparse
from pathlib import Path
import subprocess
import json
import time

parser = argparse.ArgumentParser()
parser.add_argument('--node', required=True)
parser.add_argument('--mode', choices=['worker', 'report'], required=True)
parser.add_argument('--lane', choices=['lane-1', 'lane-2'])
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
runtime = root / '.local'
if args.mode == 'worker':
    runtime = runtime / 'lanes' / (args.lane or 'legacy')
runtime.mkdir(parents=True, exist_ok=True)
cooldown = root / '.local' / 'database-cooldown.json'
try:
    retry_at = json.loads(cooldown.read_text(encoding='utf-8')).get('retryAt', 0)
except (OSError, ValueError):
    retry_at = 0
offline_queue = root / '.local' / 'offline-queue.json'
if (root / '.local' / 'offline-security-stop.json').exists():
    raise SystemExit(1)
if retry_at > time.time() and not offline_queue.exists():
    raise SystemExit(0)
# Cloud sync is independent from execution. A quota/network failure must never
# prevent locally queued work. Exclusive launch marker bounds both lanes together.
if offline_queue.exists() and retry_at <= time.time():
    sync_gate = root / '.local' / 'sync-next-at.txt'
    try:
        next_sync = float(sync_gate.read_text())
    except (OSError, ValueError):
        next_sync = 0
    # One designated lane syncs; both execute work. This avoids two launchers
    # racing a cloud refresh while retaining existing Windows scheduled jobs.
    if next_sync <= time.time() and args.mode == 'worker' and args.lane == 'lane-1':
        sync_gate.write_text(str(time.time() + 300))
        try:
            with (root / '.local' / 'sync-stderr.log').open('w', encoding='utf-8') as sync_err:
                subprocess.run([args.node, str(root / 'orchestrator' / 'sync-local.mjs')],
                               cwd=root, stdout=subprocess.DEVNULL, stderr=sync_err,
                               timeout=12, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        except subprocess.TimeoutExpired:
            pass
# An exhausted queue waits at most five minutes. Never suppress active work,
# its control checks, analytics recovery, or report publication.
if args.mode == 'worker':
    try:
        checkpoint = json.loads((runtime / 'checkpoint.json').read_text(encoding='utf-8'))
        idle_until = checkpoint.get('idleRetryAt', 0)
        now_ms = time.time() * 1000
        if (checkpoint.get('task') is None and checkpoint.get('analyticsActive') is None
                and isinstance(idle_until, (int, float))
                and now_ms < idle_until <= now_ms + 300000):
            raise SystemExit(0)
    except (OSError, ValueError, AttributeError):
        pass
script = 'report.mjs' if args.mode == 'report' else 'worker.mjs'
command = [args.node, str(root / 'orchestrator' / script)]
if args.mode == 'worker':
    command.append('--once')
    if args.lane:
        command.extend(['--lane', args.lane])
with (runtime / f'{args.mode}-stdout.log').open('w', encoding='utf-8') as out, (runtime / f'{args.mode}-stderr.log').open('w', encoding='utf-8') as err:
    result = subprocess.run(command, cwd=root, stdout=out, stderr=err,
                            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
error_text = (runtime / f'{args.mode}-stderr.log').read_text(encoding='utf-8')
if args.mode == 'worker' and result.returncode != 0:
    # Independent local alert path also catches failures before worker startup.
    # Raw logs stay local; the incident writer sanitizes its small summary.
    try:
        alert = subprocess.run([args.node, str(root / 'orchestrator' / 'launcher-incident.mjs'),
                                str(root), args.lane or 'legacy'],
                               input=json.dumps({'message': error_text[-4000:]}),
                               capture_output=True, text=True, timeout=15,
                               creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        recovery = json.loads(alert.stdout) if alert.returncode == 0 else {}
        if recovery.get('retry'):
            time.sleep(2)
            with (runtime / 'worker-stdout.log').open('a', encoding='utf-8') as out, (runtime / 'worker-stderr.log').open('a', encoding='utf-8') as err:
                result = subprocess.run(command, cwd=root, stdout=out, stderr=err,
                                        creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            # Alert remains pending until actual task progress is verified.
    except (OSError, ValueError, subprocess.TimeoutExpired):
        # Original error log is retained for independent supervisor inspection.
        pass
if 'Quota exceeded' in error_text:
    cooldown.write_text(json.dumps({'retryAt': time.time() + 1800,
                                   'reason': 'Database quota; preserve checkpoints and retry automatically.'}), encoding='utf-8')
raise SystemExit(result.returncode)
