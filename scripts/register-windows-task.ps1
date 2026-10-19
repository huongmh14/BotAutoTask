param(
  [string]$TaskName = "BotAutoTask-Daemon",
  [string]$ProjectDir = "D:\BotAutoTask"
)

$ErrorActionPreference = "Stop"
$NodePath = (Get-Command node).Source
$CliScript = Join-Path $ProjectDir "src\daemon\cli.js"

$Action = New-ScheduledTaskAction `
  -Execute $NodePath `
  -Argument "`"$CliScript`" daemon --once true" `
  -WorkingDirectory $ProjectDir

# Trigger 1: At system startup / user logon
$TriggerLogon = New-ScheduledTaskTrigger -AtLogOn

# Trigger 2: Every 10 minutes (wakes machine from Sleep/Hibernate if WakeToRun is enabled)
$TriggerRepeat = New-ScheduledTaskTrigger -Once -At (Get-Date) `
  -RepetitionInterval (New-TimeSpan -Minutes 10) `
  -RepetitionDuration (New-TimeSpan -Days 3650)

$Settings = New-ScheduledTaskSettingsSet `
  -RunOnlyIfNetworkAvailable `
  -WakeToRun `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $Action `
  -Trigger @($TriggerLogon, $TriggerRepeat) `
  -Settings $Settings `
  -Description "BotAutoTask: Runs queued multi-core AI goals automatically when internet is available and wakes PC from sleep." `
  -Force | Out-Null

Write-Host "✅ Registered Windows Scheduled Task '$TaskName' (WakeToRun + RunOnlyIfNetworkAvailable enabled)."
