param([ValidateSet('worker','report')][string]$Mode = 'worker')
$ErrorActionPreference = 'Stop'
$BccRoot = Split-Path -Parent $PSScriptRoot
$BccNode = (Get-Command node.exe).Source
$BccScript = if ($Mode -eq 'report') { 'orchestrator/report.mjs' } else { 'orchestrator/worker.mjs' }
$BccArguments = '"' + (Join-Path $BccRoot $BccScript) + '"'
if ($Mode -eq 'worker') { $BccArguments += ' --once' }
$BccRuntime = Join-Path $BccRoot '.local'
New-Item -ItemType Directory -Force -Path $BccRuntime | Out-Null
$BccProcess = Start-Process -FilePath $BccNode -ArgumentList $BccArguments -WorkingDirectory $BccRoot -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput (Join-Path $BccRuntime "$Mode-stdout.log") -RedirectStandardError (Join-Path $BccRuntime "$Mode-stderr.log")
exit $BccProcess.ExitCode
