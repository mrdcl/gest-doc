/*
  # Permission Preflight Check Function

  1. Function
    - `check_effective_read_access(doc_id, user_id)` - Checks if user will have access to document
    - Returns detailed access information and suggestions

  2. Purpose
    - Prevent "shared but without real access" scenarios
    - Provide actionable suggestions before sharing
    - Improve security and user experience

  3. Use Cases
    - Before sharing a document, check if recipient will have access
    - Show warnings and suggestions in UI
    - Reduce support tickets about access issues
*/

-- Drop function if exists (for idempotency)
DROP FUNCTION IF EXISTS check_effective_read_access(uuid, uuid);

-- Create permission preflight check function
CREATE OR REPLACE FUNCTION check_effective_read_access(
  p_doc_id uuid,
  p_user_id uuid
)
RETURNS TABLE(
  has_access boolean,
  access_reason text,
  access_type text,
  suggested_actions jsonb,
  warnings jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_document record;
  v_user_profile record;
  v_is_admin boolean := false;
  v_is_owner boolean := false;
  v_has_direct_share boolean := false;
  v_has_client_access boolean := false;
  v_entity_id uuid;
  v_client_id uuid;
  v_suggestions jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
BEGIN
  -- Get document info
  SELECT d.*, d.entity_id INTO v_document
  FROM documents d
  WHERE d.id = p_doc_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      false,
      'Document not found'::text,
      'none'::text,
      '[]'::jsonb,
      '[{"type": "error", "message": "El documento no existe"}]'::jsonb;
    RETURN;
  END IF;

  -- Get user profile
  SELECT * INTO v_user_profile
  FROM user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      false,
      'User not found'::text,
      'none'::text,
      '[]'::jsonb,
      '[{"type": "error", "message": "El usuario no existe"}]'::jsonb;
    RETURN;
  END IF;

  -- Check if user is admin
  v_is_admin := v_user_profile.role = 'admin';

  -- Check if user is document owner
  v_is_owner := v_document.uploaded_by = p_user_id;

  -- Check if document has been directly shared with user
  SELECT EXISTS(
    SELECT 1 FROM document_shares
    WHERE document_id = p_doc_id
    AND shared_with_user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO v_has_direct_share;

  -- Get entity and client IDs for client-level access check
  SELECT e.id, e.client_id INTO v_entity_id, v_client_id
  FROM entities e
  WHERE e.id = v_document.entity_id;

  -- Check if user has client-level access
  IF v_client_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM client_users
      WHERE client_id = v_client_id
      AND user_id = p_user_id
      AND is_active = true
    ) INTO v_has_client_access;
  END IF;

  -- Determine access and provide feedback
  IF v_is_admin THEN
    RETURN QUERY SELECT
      true,
      'User is system administrator'::text,
      'admin'::text,
      '[]'::jsonb,
      '[]'::jsonb;
    RETURN;
  END IF;

  IF v_is_owner THEN
    RETURN QUERY SELECT
      true,
      'User is document owner'::text,
      'owner'::text,
      '[]'::jsonb,
      '[]'::jsonb;
    RETURN;
  END IF;

  IF v_has_direct_share THEN
    RETURN QUERY SELECT
      true,
      'Document has been directly shared with user'::text,
      'direct_share'::text,
      '[]'::jsonb,
      '[]'::jsonb;
    RETURN;
  END IF;

  IF v_has_client_access THEN
    RETURN QUERY SELECT
      true,
      'User has access through client membership'::text,
      'client_access'::text,
      '[]'::jsonb,
      '[]'::jsonb;
    RETURN;
  END IF;

  -- User does NOT have access - provide suggestions
  v_suggestions := jsonb_build_array(
    jsonb_build_object(
      'action', 'share_directly',
      'label', 'Compartir directamente con el usuario',
      'description', 'Otorga acceso inmediato al documento específico'
    )
  );

  IF v_client_id IS NOT NULL THEN
    v_suggestions := v_suggestions || jsonb_build_object(
      'action', 'add_to_client',
      'label', 'Agregar usuario al espacio del cliente',
      'description', 'El usuario tendrá acceso a todos los documentos del cliente',
      'client_id', v_client_id
    );
  END IF;

  v_warnings := jsonb_build_array(
    jsonb_build_object(
      'type', 'no_access',
      'message', 'El usuario NO tendrá acceso a este documento',
      'severity', 'high'
    )
  );

  RETURN QUERY SELECT
    false,
    'User does not have access to document'::text,
    'none'::text,
    v_suggestions,
    v_warnings;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_effective_read_access(uuid, uuid) TO authenticated;

-- Comment
COMMENT ON FUNCTION check_effective_read_access IS
'Checks if a user will have effective read access to a document.
Returns access status, reason, type, suggested actions, and warnings.
Use before sharing documents to prevent access issues.';
