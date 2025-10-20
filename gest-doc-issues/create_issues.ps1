Param([string]$RepoFlag="")
Get-ChildItem issues -Filter *.md | ForEach-Object {
  $file = $_.FullName
  $front = Get-Content $file
  $title = ($front | Select-String '^title:' -CaseSensitive | Select-Object -First 1).ToString().Split(':')[1].Trim()
  $labels = ($front | Select-String '^labels:' -CaseSensitive | Select-Object -First 1).ToString().Split(':')[1].Trim()
  $milestone = ($front | Select-String '^milestone:' -CaseSensitive | Select-Object -First 1).ToString().Split(':')[1].Trim()
  $content = $false
  $body = New-Object System.Collections.Generic.List[string]
  foreach ($line in $front) {
    if ($line -match '^---\s*$') { $content = -not $content; continue }
    if ($content) { $body.Add($line) }
  }
  $tmp = [System.IO.Path]::GetTempFileName()
  $body | Out-File -FilePath $tmp -Encoding utf8
  gh issue create $RepoFlag -t "$title" -F "$tmp" --label "$labels" --milestone "$milestone"
  Remove-Item $tmp -Force
}
Write-Host "✅ Issues creados"
