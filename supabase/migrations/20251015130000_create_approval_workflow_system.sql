/*
  # Create Approval Workflow System

  1. New Tables
    - `document_workflow_states`
      - `id` (uuid, primary key)
      - `document_id` (uuid) - references documents table
      - `current_state` (text) - current workflow state
      - `previous_state` (text, nullable) - previous state for history
      - `assigned_to` (uuid, nullable) - user assigned to current step
      - `due_date` (timestamptz, nullable) - SLA due date
      - `metadata` (jsonb) - additional state metadata
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `document_workflow_transitions`
      - `id` (uuid, primary key)
      - `document_id` (uuid) - references documents table
      - `from_state` (text) - previous state
      - `to_state` (text) - new state
      - `transitioned_by` (uuid) - user who made the transition
      - `transition_type` (text) - type of transition (approve, reject, etc.)
      - `comment` (text, nullable) - optional comment
      - `metadata` (jsonb) - additional transition data
      - `created_at` (timestamptz)

  2. Workflow States
    - draft: Initial state, document being prepared
    - in_review: Document submitted for review
    - approved: Document approved by reviewer
    - rejected: Document rejected, needs changes
    - published: Document approved and published
    - archived: Document archived (final state)

  3. Valid Transitions
    - draft → in_review (submit for review)
    - in_review → approved (approve)
    - in_review → rejected (reject)
    - rejected → draft (revise)
    - approved → published (publish)
    - published → archived (archive)
    - Any → archived (force archive)

  4. Security
    - Enable RLS on all workflow tables
    - Add policies for workflow management
    - Audit all transitions
    - Prevent invalid state transitions

  5. Performance
    - Indexes on document_id for fast lookups
    - Indexes on current_state for filtering
    - Indexes on assigned_to for task lists
*/

-- Create workflow states enum type
DO $$ BEGIN
  CREATE TYPE document_workflow_state AS ENUM (
    'draft',
    'in_review',
    'approved',
    'rejected',
    'published',
    'archived'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create workflow transitions enum type
DO $$ BEGIN
  CREATE TYPE workflow_transition_type AS ENUM (
    'submit',
    'approve',
    'reject',
    'revise',
    'publish',
    'archive'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create document_workflow_states table
CREATE TABLE IF NOT EXISTS document_workflow_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  current_state document_workflow_state NOT NULL DEFAULT 'draft',
  previous_state document_workflow_state,
  assigned_to uuid REFERENCES auth.users(id),
  due_date timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(document_id)
);

-- Create document_workflow_transitions table
CREATE TABLE IF NOT EXISTS document_workflow_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  from_state document_workflow_state NOT NULL,
  to_state document_workflow_state NOT NULL,
  transitioned_by uuid NOT NULL REFERENCES auth.users(id),
  transition_type workflow_transition_type NOT NULL,
  comment text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE document_workflow_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_workflow_transitions ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_states_document_id
  ON document_workflow_states(document_id);

CREATE INDEX IF NOT EXISTS idx_workflow_states_current_state
  ON document_workflow_states(current_state);

CREATE INDEX IF NOT EXISTS idx_workflow_states_assigned_to
  ON document_workflow_states(assigned_to)
  WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_states_due_date
  ON document_workflow_states(due_date)
  WHERE due_date IS NOT NULL AND current_state NOT IN ('published', 'archived');

CREATE INDEX IF NOT EXISTS idx_workflow_transitions_document_id
  ON document_workflow_transitions(document_id);

CREATE INDEX IF NOT EXISTS idx_workflow_transitions_created_at
  ON document_workflow_transitions(created_at DESC);

-- Function to validate workflow transition
CREATE OR REPLACE FUNCTION validate_workflow_transition(
  p_from_state document_workflow_state,
  p_to_state document_workflow_state,
  p_transition_type workflow_transition_type
) RETURNS boolean AS $$
BEGIN
  -- Define valid transitions
  RETURN (
    (p_from_state = 'draft' AND p_to_state = 'in_review' AND p_transition_type = 'submit') OR
    (p_from_state = 'in_review' AND p_to_state = 'approved' AND p_transition_type = 'approve') OR
    (p_from_state = 'in_review' AND p_to_state = 'rejected' AND p_transition_type = 'reject') OR
    (p_from_state = 'rejected' AND p_to_state = 'draft' AND p_transition_type = 'revise') OR
    (p_from_state = 'approved' AND p_to_state = 'published' AND p_transition_type = 'publish') OR
    (p_from_state = 'published' AND p_to_state = 'archived' AND p_transition_type = 'archive') OR
    (p_to_state = 'archived' AND p_transition_type = 'archive') -- Allow archive from any state
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to transition workflow state
CREATE OR REPLACE FUNCTION transition_workflow_state(
  p_document_id uuid,
  p_to_state document_workflow_state,
  p_transition_type workflow_transition_type,
  p_user_id uuid,
  p_comment text DEFAULT NULL,
  p_assigned_to uuid DEFAULT NULL,
  p_due_date timestamptz DEFAULT NULL
) RETURNS TABLE(
  success boolean,
  error_message text,
  new_state document_workflow_state
) AS $$
DECLARE
  v_current_state document_workflow_state;
  v_is_valid boolean;
BEGIN
  -- Get current state
  SELECT current_state INTO v_current_state
  FROM document_workflow_states
  WHERE document_id = p_document_id;

  -- If no state exists, initialize as draft
  IF NOT FOUND THEN
    INSERT INTO document_workflow_states (document_id, current_state)
    VALUES (p_document_id, 'draft');
    v_current_state := 'draft';
  END IF;

  -- Validate transition
  v_is_valid := validate_workflow_transition(v_current_state, p_to_state, p_transition_type);

  IF NOT v_is_valid THEN
    RETURN QUERY SELECT false, 'Invalid state transition'::text, v_current_state;
    RETURN;
  END IF;

  -- Record transition
  INSERT INTO document_workflow_transitions (
    document_id,
    from_state,
    to_state,
    transitioned_by,
    transition_type,
    comment,
    metadata
  ) VALUES (
    p_document_id,
    v_current_state,
    p_to_state,
    p_user_id,
    p_transition_type,
    p_comment,
    jsonb_build_object(
      'previous_assigned_to', (SELECT assigned_to FROM document_workflow_states WHERE document_id = p_document_id)
    )
  );

  -- Update state
  UPDATE document_workflow_states
  SET
    previous_state = v_current_state,
    current_state = p_to_state,
    assigned_to = COALESCE(p_assigned_to, assigned_to),
    due_date = COALESCE(p_due_date, due_date),
    updated_at = now()
  WHERE document_id = p_document_id;

  -- Log audit action
  PERFORM log_audit_action(
    p_user_id,
    (SELECT email FROM auth.users WHERE id = p_user_id),
    'UPDATE',
    'document_workflow',
    p_document_id,
    (SELECT name FROM documents WHERE id = p_document_id),
    jsonb_build_object(
      'from_state', v_current_state,
      'to_state', p_to_state,
      'transition_type', p_transition_type,
      'comment', p_comment
    )
  );

  RETURN QUERY SELECT true, NULL::text, p_to_state;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pending tasks for a user
CREATE OR REPLACE FUNCTION get_pending_workflow_tasks(p_user_id uuid)
RETURNS TABLE(
  document_id uuid,
  document_name text,
  current_state document_workflow_state,
  assigned_at timestamptz,
  due_date timestamptz,
  days_remaining integer,
  is_overdue boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ws.document_id,
    d.title as document_name,
    ws.current_state,
    ws.updated_at as assigned_at,
    ws.due_date,
    CASE
      WHEN ws.due_date IS NOT NULL THEN
        EXTRACT(days FROM ws.due_date - now())::integer
      ELSE NULL
    END as days_remaining,
    CASE
      WHEN ws.due_date IS NOT NULL AND ws.due_date < now() THEN true
      ELSE false
    END as is_overdue
  FROM document_workflow_states ws
  JOIN documents d ON d.id = ws.document_id
  WHERE ws.assigned_to = p_user_id
    AND ws.current_state NOT IN ('published', 'archived')
  ORDER BY
    CASE WHEN ws.due_date IS NOT NULL AND ws.due_date < now() THEN 0 ELSE 1 END,
    ws.due_date NULLS LAST,
    ws.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies

-- Policy: Users can view workflow states for documents they can access
CREATE POLICY "Users can view workflow states for accessible documents"
  ON document_workflow_states
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_id
      AND (
        d.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM document_access da
          WHERE da.document_id = d.id
          AND da.user_id = auth.uid()
        )
      )
    )
  );

-- Policy: Users can insert workflow states for their documents
CREATE POLICY "Users can create workflow states for own documents"
  ON document_workflow_states
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_id
      AND d.owner_id = auth.uid()
    )
  );

-- Policy: Users can update workflow states for assigned documents
CREATE POLICY "Users can update workflow states"
  ON document_workflow_states
  FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_id
      AND d.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_id
      AND d.owner_id = auth.uid()
    )
  );

-- Policy: Users can view workflow transitions for accessible documents
CREATE POLICY "Users can view workflow transitions for accessible documents"
  ON document_workflow_transitions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_id
      AND (
        d.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM document_access da
          WHERE da.document_id = d.id
          AND da.user_id = auth.uid()
        )
      )
    )
  );

-- Policy: Transitions are created via function only
CREATE POLICY "Workflow transitions created via function"
  ON document_workflow_transitions
  FOR INSERT
  TO authenticated
  WITH CHECK (false); -- Only allow inserts through the function

-- Create view for workflow analytics
CREATE OR REPLACE VIEW workflow_analytics AS
SELECT
  ws.current_state,
  COUNT(*) as document_count,
  COUNT(CASE WHEN ws.due_date IS NOT NULL AND ws.due_date < now() THEN 1 END) as overdue_count,
  AVG(EXTRACT(epoch FROM (now() - ws.created_at)) / 86400) as avg_days_in_state
FROM document_workflow_states ws
WHERE ws.current_state NOT IN ('published', 'archived')
GROUP BY ws.current_state;

-- Grant permissions on view
GRANT SELECT ON workflow_analytics TO authenticated;

-- Create view for transition history
CREATE OR REPLACE VIEW workflow_transition_history AS
SELECT
  wt.id,
  wt.document_id,
  d.title as document_name,
  wt.from_state,
  wt.to_state,
  wt.transition_type,
  wt.transitioned_by,
  u.email as transitioned_by_email,
  wt.comment,
  wt.created_at,
  EXTRACT(epoch FROM (wt.created_at - LAG(wt.created_at) OVER (PARTITION BY wt.document_id ORDER BY wt.created_at))) / 3600 as hours_since_last_transition
FROM document_workflow_transitions wt
JOIN documents d ON d.id = wt.document_id
LEFT JOIN auth.users u ON u.id = wt.transitioned_by
ORDER BY wt.created_at DESC;

-- Grant permissions on view
GRANT SELECT ON workflow_transition_history TO authenticated;
