Param([string]$Repo="")

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $here "..")

Get-ChildItem .\scripts\*.ps1 -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue

$pwsh = Get-Command pwsh -ErrorAction SilentlyContinue

if ($pwsh) {
  & pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\create_labels.ps1 -Repo $Repo
  & pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\create_milestones.ps1 -Repo $Repo
  & pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\create_issues.ps1 -Repo $Repo
} else {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\create_labels.ps1 -Repo $Repo
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\create_milestones.ps1 -Repo $Repo
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\create_issues.ps1 -Repo $Repo
}

Write-Host "✅ Proceso completado"
