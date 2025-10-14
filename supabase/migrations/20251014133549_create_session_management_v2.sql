/*
  # Sistema de Gestión de Sesiones

  ## Descripción
  Sistema para rastrear y gestionar sesiones activas de usuarios.

  ## Nueva Tabla
  
  ### `user_sessions`
  - `id` (uuid, primary key)
  - `user_id` (uuid) - Usuario
  - `session_token` (text) - Token de sesión
  - `ip_address` (inet) - Dirección IP
  - `user_agent` (text) - User agent del navegador
  - `device_info` (jsonb) - Información del dispositivo
  - `last_activity` (timestamptz) - Última actividad
  - `expires_at` (timestamptz) - Expiración de sesión
  - `is_active` (boolean) - Si está activa
  - `created_at` (timestamptz)

  ## Seguridad
  - RLS habilitado
  - Usuarios solo ven sus propias sesiones
*/

-- Crear tabla de sesiones
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_token text UNIQUE NOT NULL,
  ip_address inet,
  user_agent text,
  device_info jsonb DEFAULT '{}'::jsonb,
  last_activity timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- Habilitar RLS
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios ven sus sesiones
CREATE POLICY "Users can view own sessions"
  ON user_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Política: Usuarios pueden actualizar sus sesiones
CREATE POLICY "Users can update own sessions"
  ON user_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuarios pueden eliminar sus sesiones
CREATE POLICY "Users can delete own sessions"
  ON user_sessions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Función para limpiar sesiones expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH deleted_sessions AS (
    DELETE FROM user_sessions
    WHERE expires_at < now() OR (last_activity < now() - interval '7 days' AND is_active = false)
    RETURNING id
  )
  SELECT COUNT(*)::integer INTO deleted_count FROM deleted_sessions;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para invalidar sesión
CREATE OR REPLACE FUNCTION invalidate_session(p_session_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE user_sessions
  SET is_active = false
  WHERE id = p_session_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para invalidar todas las sesiones excepto la actual
CREATE OR REPLACE FUNCTION invalidate_other_sessions(p_current_session_id uuid)
RETURNS integer AS $$
DECLARE
  invalidated_count integer;
BEGIN
  WITH invalidated AS (
    UPDATE user_sessions
    SET is_active = false
    WHERE user_id = auth.uid() 
    AND id != p_current_session_id
    AND is_active = true
    RETURNING id
  )
  SELECT COUNT(*)::integer INTO invalidated_count FROM invalidated;
  
  RETURN invalidated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vista de sesiones activas
CREATE OR REPLACE VIEW active_sessions AS
SELECT 
  us.*,
  up.full_name
FROM user_sessions us
JOIN user_profiles up ON us.user_id = up.id
WHERE us.is_active = true AND us.expires_at > now()
ORDER BY us.last_activity DESC;

-- Comentarios
COMMENT ON TABLE user_sessions IS 'Sesiones activas de usuarios';
COMMENT ON FUNCTION cleanup_expired_sessions IS 'Limpia sesiones expiradas e inactivas';
COMMENT ON FUNCTION invalidate_session IS 'Invalida una sesión específica';
COMMENT ON FUNCTION invalidate_other_sessions IS 'Invalida todas las sesiones excepto la especificada';
COMMENT ON VIEW active_sessions IS 'Vista de sesiones activas con información de usuario';
