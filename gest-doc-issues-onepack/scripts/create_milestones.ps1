Param([string]$Repo="")
$repoFlag = ""
if ($Repo -ne "") { $repoFlag = "-R $Repo" }
$milestones = @("P0","P1","P2","P3","P4","P5","P6")
foreach ($m in $milestones) {
  try {
    gh api $repoFlag -X POST repos/:owner/:repo/milestones -f title="$m" | Out-Null
  } catch {}
}
Write-Host "✅ Milestones creados (o ya existían)"
