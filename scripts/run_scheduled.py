"""Run BCC without opening console windows; preserve bounded local logs."""
import argparse
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--node', required=True)
parser.add_argument('--mode', choices=['worker', 'report'], required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
runtime = root / '.local'
runtime.mkdir(exist_ok=True)
script = 'report.mjs' if args.mode == 'report' else 'worker.mjs'
command = [args.node, str(root / 'orchestrator' / script)]
if args.mode == 'worker':
    command.append('--once')
with (runtime / f'{args.mode}-stdout.log').open('w', encoding='utf-8') as out, (runtime / f'{args.mode}-stderr.log').open('w', encoding='utf-8') as err:
    result = subprocess.run(command, cwd=root, stdout=out, stderr=err,
                            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
raise SystemExit(result.returncode)
