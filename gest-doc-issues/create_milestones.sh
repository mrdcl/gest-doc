#!/usr/bin/env bash
set -euo pipefail
REPO_FLAG=${1:-}
milestones=(P0 P1 P2 P3 P4 P5 P6)
for m in "${milestones[@]}"; do
  # Create or update (gh doesn't have 'force' for milestones, so ignore errors)
  gh api $REPO_FLAG -X POST repos/:owner/:repo/milestones -f title="$m" >/dev/null 2>&1 || true
done
echo "✅ Milestones creados (o ya existían)"
