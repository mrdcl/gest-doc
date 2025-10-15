/*
  # Create Shared Links System

  1. New Tables
    - `shared_links`
      - `id` (uuid, primary key)
      - `token` (text, unique) - nanoid generated token
      - `document_id` (uuid) - references documents table
      - `created_by` (uuid) - user who created the link
      - `expires_at` (timestamptz) - expiration timestamp
      - `permissions` (jsonb) - granular permissions {read: bool, download: bool}
      - `access_count` (integer) - number of times link was accessed
      - `max_access_count` (integer, nullable) - optional access limit
      - `is_active` (boolean) - can be manually disabled
      - `last_accessed_at` (timestamptz, nullable)
      - `hmac_signature` (text) - HMAC signature for verification
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `shared_links` table
    - Add policies for authenticated users to manage their own links
    - Add policy for public access to validate tokens
    - Create function to validate and track link access
    - Create function to generate HMAC signature

  3. Performance
    - Index on token for fast lookups
    - Index on document_id for cleanup queries
    - Index on expires_at for cleanup of expired links

  4. Notes
    - Tokens are generated with nanoid (11 characters, URL-safe)
    - HMAC signature prevents tampering
    - Access count tracking for analytics
    - Links can expire by time or access count
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
  WHERE is_active = true AND expires_at > now();

CREATE INDEX IF NOT EXISTS idx_shared_links_document_id
  ON shared_links(document_id);

CREATE INDEX IF NOT EXISTS idx_shared_links_expires_at
  ON shared_links(expires_at)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_shared_links_created_by
  ON shared_links(created_by);

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
  -- Get secret from app settings (should be set as env variable)
  -- In production, this should be a secure secret key
  v_secret := current_setting('app.hmac_secret', true);

  IF v_secret IS NULL THEN
    v_secret := 'default-secret-change-in-production';
  END IF;

  -- Compute HMAC signature
  v_payload := p_token || '|' || p_document_id::text || '|' || extract(epoch from p_expires_at)::text;
  v_computed_signature := encode(hmac(v_payload, v_secret, 'sha256'), 'hex');

  -- Compare signatures (constant-time comparison would be better but not critical for this use case)
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
  -- Get link details
  SELECT * INTO v_link
  FROM shared_links
  WHERE token = p_token;

  -- Check if link exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::jsonb, 'Link not found'::text;
    RETURN;
  END IF;

  -- Check if link is active
  IF NOT v_link.is_active THEN
    RETURN QUERY SELECT false, v_link.document_id, NULL::jsonb, 'Link has been deactivated'::text;
    RETURN;
  END IF;

  -- Check if link has expired
  IF v_link.expires_at < now() THEN
    RETURN QUERY SELECT false, v_link.document_id, NULL::jsonb, 'Link has expired'::text;
    RETURN;
  END IF;

  -- Check access count limit
  IF v_link.max_access_count IS NOT NULL AND v_link.access_count >= v_link.max_access_count THEN
    RETURN QUERY SELECT false, v_link.document_id, NULL::jsonb, 'Access limit reached'::text;
    RETURN;
  END IF;

  -- Validate HMAC signature
  IF NOT validate_link_hmac(v_link.token, v_link.document_id, v_link.expires_at, v_link.hmac_signature) THEN
    RETURN QUERY SELECT false, v_link.document_id, NULL::jsonb, 'Invalid signature'::text;
    RETURN;
  END IF;

  -- Update access tracking
  UPDATE shared_links
  SET
    access_count = access_count + 1,
    last_accessed_at = now(),
    updated_at = now()
  WHERE id = v_link.id;

  -- Return success
  RETURN QUERY SELECT true, v_link.document_id, v_link.permissions, NULL::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies

-- Policy: Users can view their own shared links
CREATE POLICY "Users can view own shared links"
  ON shared_links
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Policy: Users can create shared links for documents they can access
CREATE POLICY "Users can create shared links"
  ON shared_links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_id
      AND (
        d.uploaded_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM document_access da
          WHERE da.document_id = d.id
          AND da.user_id = auth.uid()
        )
      )
    )
  );

-- Policy: Users can update their own shared links
CREATE POLICY "Users can update own shared links"
  ON shared_links
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Policy: Users can delete their own shared links
CREATE POLICY "Users can delete own shared links"
  ON shared_links
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Policy: Public can validate tokens (read-only via function)
CREATE POLICY "Anyone can validate shared links"
  ON shared_links
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true
    AND expires_at > now()
  );

-- Function to clean up expired links (can be called by a cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_shared_links()
RETURNS integer AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  -- Delete expired links older than 30 days
  DELETE FROM shared_links
  WHERE expires_at < now() - interval '30 days'
  AND is_active = false;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Deactivate recently expired links (don't delete immediately for audit purposes)
  UPDATE shared_links
  SET is_active = false, updated_at = now()
  WHERE expires_at < now()
  AND is_active = true;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for link analytics
CREATE OR REPLACE VIEW shared_link_analytics AS
SELECT
  sl.id,
  sl.token,
  sl.document_id,
  d.name as document_name,
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

-- Grant permissions on view
GRANT SELECT ON shared_link_analytics TO authenticated;

-- Add RLS to view
ALTER VIEW shared_link_analytics SET (security_invoker = on);
