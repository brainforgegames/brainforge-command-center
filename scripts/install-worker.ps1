param([switch]$Uninstall)
$ErrorActionPreference = 'Stop'
$BccRoot = Split-Path -Parent $PSScriptRoot
$BccTaskName = 'Brainforge Command Center Worker'
$BccReportTaskName = 'Brainforge Command Center Reports'
if ($Uninstall) { Unregister-ScheduledTask -TaskName $BccTaskName -Confirm:$false; Unregister-ScheduledTask -TaskName $BccReportTaskName -Confirm:$false; exit }
if (-not (Test-Path -LiteralPath (Join-Path $BccRoot 'worker.config.json'))) { throw 'Configure worker.config.json before installing.' }
$BccPowerShell = (Get-Command powershell.exe).Source
$BccLauncher = Join-Path $BccRoot 'scripts/run-scheduled.ps1'
$BccAction = New-ScheduledTaskAction -Execute $BccPowerShell -Argument ('-NoProfile -WindowStyle Hidden -File "' + $BccLauncher + '" -Mode worker') -WorkingDirectory $BccRoot
$BccTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
$BccSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName $BccTaskName -Action $BccAction -Trigger $BccTrigger -Settings $BccSettings -Description 'Runs approved BCC tasks locally, reports at 22:00 IST, pauses at 23:00 IST.' -Force | Out-Null
$BccReportAction = New-ScheduledTaskAction -Execute $BccPowerShell -Argument ('-NoProfile -WindowStyle Hidden -File "' + $BccLauncher + '" -Mode report') -WorkingDirectory $BccRoot
$BccReportSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $BccReportTaskName -Action $BccReportAction -Trigger $BccTrigger -Settings $BccReportSettings -Description 'Independent daily report at 22:00 IST, and expired report cleanup, without AI calls.' -Force | Out-Null
Write-Output 'Installed for the current Windows user. Laptop must be awake; no password or billing changes were made.'
