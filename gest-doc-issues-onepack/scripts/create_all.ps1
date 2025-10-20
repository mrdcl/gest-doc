Param([string]$Repo)

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $here "..")

# Quita marca de Internet por si el ZIP fue descargado
Get-ChildItem .\scripts\*.ps1 -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue

# Helper que ejecuta un script .ps1 pasando -Repo SOLO si tiene valor
function Invoke-Child {
  param([string]$ScriptPath, [string]$RepoValue)

  # Detectar pwsh; si no hay, usar powershell.exe
  $runner = (Get-Command pwsh -ErrorAction SilentlyContinue)
  if ($runner) {
    if ([string]::IsNullOrWhiteSpace($RepoValue)) {
      & pwsh -NoProfile -ExecutionPolicy Bypass -File $ScriptPath
    } else {
      & pwsh -NoProfile -ExecutionPolicy Bypass -File $ScriptPath -Repo $RepoValue
    }
  } else {
    if ([string]::IsNullOrWhiteSpace($RepoValue)) {
      & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ScriptPath
    } else {
      & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ScriptPath -Repo $RepoValue
    }
  }
}

Invoke-Child ".\scripts\create_labels.ps1"      $Repo
Invoke-Child ".\scripts\create_milestones.ps1"  $Repo
Invoke-Child ".\scripts\create_issues.ps1"      $Repo

Write-Host "✅ Proceso completado"
