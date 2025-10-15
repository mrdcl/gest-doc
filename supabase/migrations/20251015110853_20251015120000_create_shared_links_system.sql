/*
  # Create Shared Links System

  1. New Tables
    - `shared_links` with security and tracking features

  2. Security
    - RLS policies for access control
    - HMAC signature validation
    - Public token validation

  3. Performance
    - Optimized indexes for fast lookups
*/

-- Create shared_links table
CREATE TABLE IF NOT EXISTS shared_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{"read": true, "download": false}'::jsonb,
  access_count integer DEFAULT 0,
  max_access_count integer,
  is_active boolean DEFAULT true,
  last_accessed_at timestamptz,
  hmac_signature text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE shared_links ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shared_links_token
  ON shared_links(token)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_shared_links_document_id
  ON shared_links(document_id);

CREATE INDEX IF NOT EXISTS idx_shared_links_expires_at
  ON shared_links(expires_at)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_shared_links_created_by
  ON shared_links(created_by);

CREATE INDEX IF NOT EXISTS idx_shared_links_active_not_expired
  ON shared_links(is_active, expires_at);

-- Function to validate HMAC signature
CREATE OR REPLACE FUNCTION validate_link_hmac(
  p_token text,
  p_document_id uuid,
  p_expires_at timestamptz,
  p_signature text
) RETURNS boolean AS $$
DECLARE
  v_secret text;
  v_computed_signature text;
  v_payload text;
BEGIN
  v_secret := current_setting('app.hmac_secret', true);

  IF v_secret IS NULL THEN
    v_secret := 'default-secret-change-in-production';
  END IF;

  v_payload := p_token || '|' || p_document_id::text || '|' || extract(epoch from p_expires_at)::text;
  v_computed_signature := encode(hmac(v_payload, v_secret, 'sha256'), 'hex');

  RETURN v_computed_signature = p_signature;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate and track shared link access
CREATE OR REPLACE FUNCTION validate_shared_link(p_token text)
RETURNS TABLE(
  valid boolean,
  document_id uuid,
  permissions jsonb,
  error_message text
) AS $$
DECLARE
  v_link record;
BEGIN
  SELECT * INTO v_link FROM shared_links WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::jsonb, 'Link not found'::text;
    RETURN;
  END IF;

  IF NOT v_link.is_active THEN
    RETURN QUERY SELECT false, v_link.document_id, NULL::jsonb, 'Link has been deactivated'::text;
    RETURN;
  END IF;

  IF v_link.expires_at < now() THEN
    RETURN QUERY SELECT false, v_link.document_id, NULL::jsonb, 'Link has expired'::text;
    RETURN;
  END IF;

  IF v_link.max_access_count IS NOT NULL AND v_link.access_count >= v_link.max_access_count THEN
    RETURN QUERY SELECT false, v_link.document_id, NULL::jsonb, 'Access limit reached'::text;
    RETURN;
  END IF;

  IF NOT validate_link_hmac(v_link.token, v_link.document_id, v_link.expires_at, v_link.hmac_signature) THEN
    RETURN QUERY SELECT false, v_link.document_id, NULL::jsonb, 'Invalid signature'::text;
    RETURN;
  END IF;

  UPDATE shared_links
  SET
    access_count = access_count + 1,
    last_accessed_at = now(),
    updated_at = now()
  WHERE id = v_link.id;

  RETURN QUERY SELECT true, v_link.document_id, v_link.permissions, NULL::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
CREATE POLICY "Users can view own shared links"
  ON shared_links FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can create shared links"
  ON shared_links FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_id
      AND (
        d.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM document_access da
          WHERE da.document_id = d.id AND da.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can update own shared links"
  ON shared_links FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete own shared links"
  ON shared_links FOR DELETE TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Anyone can validate shared links"
  ON shared_links FOR SELECT TO anon, authenticated
  USING (is_active = true AND expires_at > now());

-- Cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_shared_links()
RETURNS integer AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM shared_links
  WHERE expires_at < now() - interval '30 days' AND is_active = false;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  UPDATE shared_links
  SET is_active = false, updated_at = now()
  WHERE expires_at < now() AND is_active = true;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Analytics view
CREATE OR REPLACE VIEW shared_link_analytics AS
SELECT
  sl.id,
  sl.token,
  sl.document_id,
  d.title as document_name,
  sl.created_by,
  u.email as created_by_email,
  sl.created_at,
  sl.expires_at,
  sl.access_count,
  sl.max_access_count,
  sl.last_accessed_at,
  sl.is_active,
  CASE
    WHEN sl.expires_at < now() THEN 'expired'
    WHEN sl.max_access_count IS NOT NULL AND sl.access_count >= sl.max_access_count THEN 'limit_reached'
    WHEN NOT sl.is_active THEN 'deactivated'
    ELSE 'active'
  END as status
FROM shared_links sl
JOIN documents d ON d.id = sl.document_id
LEFT JOIN auth.users u ON u.id = sl.created_by;

GRANT SELECT ON shared_link_analytics TO authenticated;
ALTER VIEW shared_link_analytics SET (security_invoker = on);
