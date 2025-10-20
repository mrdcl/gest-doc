#!/usr/bin/env bash
set -euo pipefail
REPO_FLAG=${1:-}
# If you want to target a repo explicitly, pass "-R owner/repo"
labels=(
  "P0" "P1" "P2" "P3" "P4" "P5" "P6"
  "security" "backend" "supabase" "dx" "quality" "typescript"
  "observability" "analytics" "ux" "onboarding" "frontend" "uploads"
  "forms" "sql" "performance" "admin" "csv" "organization"
  "compliance" "ops" "workflow" "collaboration" "links"
  "ai" "database" "pgvector" "retrieval" "llamaindex" "inference" "ollama"
  "workers" "redis" "bullmq" "diff" "reports" "pdf" "db" "indexes" "audit"
  "search" "typesense" "accessibility" "a11y"
)
for l in "${labels[@]}"; do
  gh label create "$l" --force $REPO_FLAG >/dev/null
done
echo "✅ Labels creadas/actualizadas"
