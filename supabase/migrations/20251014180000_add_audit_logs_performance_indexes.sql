/*
  # Add Performance Indexes to Audit Logs

  1. Indexes
    - Add index on user_id for filtering by user
    - Add index on entity_type for filtering by entity type
    - Add index on action for filtering by action
    - Add index on created_at for date range queries
    - Add composite index for common query patterns

  2. Purpose
    - Optimize audit log queries for export
    - Support filtering by multiple dimensions
    - Enable fast CSV exports of 10,000+ rows

  3. Performance Target
    - Export 10,000 rows in <3 seconds
*/

-- Index on user_id for user-specific queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
  ON audit_logs(user_id);

-- Index on entity_type for filtering by type (document, user, category, etc)
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type
  ON audit_logs(entity_type);

-- Index on action for filtering by action type (CREATE, UPDATE, DELETE, VIEW, etc)
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON audit_logs(action);

-- Index on created_at for date range queries (most recent first)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc
  ON audit_logs(created_at DESC);

-- Composite index for common filter combinations
-- Useful for queries like: "show me all document views by user X in the last 7 days"
CREATE INDEX IF NOT EXISTS idx_audit_logs_composite
  ON audit_logs(entity_type, user_id, action, created_at DESC);

-- Index on entity_id for finding all actions on a specific entity
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id
  ON audit_logs(entity_id);

-- Analyze table to update statistics for query planner
ANALYZE audit_logs;
