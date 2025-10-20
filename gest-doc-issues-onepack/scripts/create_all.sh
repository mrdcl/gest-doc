#!/usr/bin/env bash
set -euo pipefail
REPO="${1:-}"
cd "$(dirname "$0")/.."
chmod +x scripts/*.sh || true
scripts/create_labels.sh "${REPO}"
scripts/create_milestones.sh "${REPO}"
scripts/create_issues.sh "${REPO}"
echo "✅ Proceso completado (bash)"
