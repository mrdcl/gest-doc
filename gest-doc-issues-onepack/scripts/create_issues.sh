#!/usr/bin/env bash
set -euo pipefail
REPO="${1:-}"
if [[ -n "${REPO}" ]]; then
  REPO_FLAG="-R ${REPO}"
else
  REPO_FLAG=""
fi
shopt -s nullglob
for file in issues/*.md; do
  title=$(grep -m1 '^title:' "$file" | sed 's/^title:\s*//')
  labels=$(grep -m1 '^labels:' "$file" | sed 's/^labels:\s*//')
  milestone=$(grep -m1 '^milestone:' "$file" | sed 's/^milestone:\s*//')
  body_file=$(mktemp)
  awk 'BEGIN{infront=0} /^---\s*$/{infront++; next} infront<2{next} {print}' "$file" > "$body_file"
  gh issue create ${REPO_FLAG} -t "$title" -F "$body_file" --label "$labels" --milestone "$milestone"
  rm -f "$body_file"
done
echo "✅ Issues creados"
