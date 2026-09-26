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

$taskContent = Get-Content -Path $taskFile -Raw
$prompt = @"
You are being invoked RIGHT NOW by the Windows Task Scheduler job that
runs this recurring task on its weekly schedule. This is not a reference
document to skim -- it is your actual, fully-authorized instruction for
this session, and this session has no user to ask for confirmation or
clarification. Do not ask whether to proceed, whether this counts as
"today's task", or what the user would like -- begin executing Step 1
immediately and carry the run through to Step 9. If you finish this
message still uncertain whether to act, that uncertainty itself is
wrong: proceed.

$taskContent
"@

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"===== Run started $timestamp =====" | Out-File -FilePath $logFile -Append -Encoding utf8

& $claudeExe -p $prompt --settings $settingsFile *>> $logFile

$exitCode = $LASTEXITCODE
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"===== Run finished $timestamp (exit code $exitCode) =====" | Out-File -FilePath $logFile -Append -Encoding utf8
