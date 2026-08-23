# Wrapper invoked by Windows Task Scheduler to run the periodic EconGradAlert
# update headlessly. See AGENT_TASK.md for what the task itself does.
#
# Scope: only ever touches apps/EconGradAlert/ (enforced by both the task
# prompt and agent-settings.json's permission allow-list). Runs claude -p
# with that dedicated settings file so this scheduled job's permissions
# never affect normal interactive Claude Code sessions in this repo.

$ErrorActionPreference = "Stop"

$appDir = $PSScriptRoot
$repoRoot = Split-Path -Parent (Split-Path -Parent $appDir)
Set-Location -Path $repoRoot

$claudeExe = Join-Path $env:USERPROFILE ".local\bin\claude.exe"
$taskFile = Join-Path $appDir "AGENT_TASK.md"
$settingsFile = Join-Path $appDir "agent-settings.json"
$logFile = Join-Path $appDir "update_log.txt"

$prompt = Get-Content -Path $taskFile -Raw

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"===== Run started $timestamp =====" | Out-File -FilePath $logFile -Append -Encoding utf8

& $claudeExe -p $prompt --settings $settingsFile *>> $logFile

$exitCode = $LASTEXITCODE
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"===== Run finished $timestamp (exit code $exitCode) =====" | Out-File -FilePath $logFile -Append -Encoding utf8
