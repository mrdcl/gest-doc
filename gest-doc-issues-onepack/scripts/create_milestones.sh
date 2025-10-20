#!/usr/bin/env bash
set -euo pipefail
REPO="${1:-}"
if [[ -n "${REPO}" ]]; then
  REPO_FLAG="-R ${REPO}"
else
  REPO_FLAG=""
fi
milestones=(P0 P1 P2 P3 P4 P5 P6)
for m in "${milestones[@]}"; do
  gh api ${REPO_FLAG} -X POST repos/:owner/:repo/milestones -f title="$m" >/dev/null 2>&1 || true
done
echo "✅ Milestones creados (o ya existían)"
