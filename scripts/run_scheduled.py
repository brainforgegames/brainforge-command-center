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
if retry_at > time.time():
    raise SystemExit(0)
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
if 'Quota exceeded' in error_text:
    cooldown.write_text(json.dumps({'retryAt': time.time() + 1800,
                                   'reason': 'Database quota; preserve checkpoints and retry automatically.'}), encoding='utf-8')
raise SystemExit(result.returncode)
