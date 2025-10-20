Param([string]$Repo="")
$repoFlag = ""
if ($Repo -ne "") { $repoFlag = "-R $Repo" }
$labels = @(
  "P0","P1","P2","P3","P4","P5","P6",
  "security","backend","supabase","dx","quality","typescript",
  "observability","analytics","ux","onboarding","frontend","uploads",
  "forms","sql","performance","admin","csv","organization",
  "compliance","ops","workflow","collaboration","links",
  "ai","database","pgvector","retrieval","llamaindex","inference","ollama",
  "workers","redis","bullmq","diff","reports","pdf","db","indexes","audit",
  "search","typesense","accessibility","a11y","docs","process","qa","checklist"
)
foreach ($l in $labels) {
  gh label create $l --force $repoFlag | Out-Null
}
Write-Host "✅ Labels creadas/actualizadas"
