/*
  # Actualización del Sistema de Auditoría

  ## Descripción
  Actualiza la tabla audit_logs existente para convertirla en un sistema
  de auditoría completo que registre todas las acciones importantes.

  ## Cambios
  1. Agregar columnas necesarias para auditoría completa
  2. Actualizar políticas RLS
  3. Crear funciones helper para logging automático
  4. Crear vista simplificada para consultas

  ## Nuevas Columnas
  - user_email (text) - Email del usuario
  - entity_type (text) - Tipo de entidad afectada
  - entity_id (uuid) - ID de la entidad
  - entity_name (text) - Nombre de la entidad
  - old_value (jsonb) - Valor anterior
  - new_value (jsonb) - Valor nuevo
  - ip_address (inet) - IP del usuario
  - user_agent (text) - User agent
  - metadata (jsonb) - Datos adicionales
*/

-- Agregar columnas si no existen
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'user_email') THEN
    ALTER TABLE audit_logs ADD COLUMN user_email text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'entity_type') THEN
    ALTER TABLE audit_logs ADD COLUMN entity_type text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'entity_id') THEN
    ALTER TABLE audit_logs ADD COLUMN entity_id uuid;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'entity_name') THEN
    ALTER TABLE audit_logs ADD COLUMN entity_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'old_value') THEN
    ALTER TABLE audit_logs ADD COLUMN old_value jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'new_value') THEN
    ALTER TABLE audit_logs ADD COLUMN new_value jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'ip_address') THEN
    ALTER TABLE audit_logs ADD COLUMN ip_address inet;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'user_agent') THEN
    ALTER TABLE audit_logs ADD COLUMN user_agent text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'metadata') THEN
    ALTER TABLE audit_logs ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Crear índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);

-- Eliminar políticas antiguas restrictivas si existen
DROP POLICY IF EXISTS "Admins and RC can view audit logs" ON audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;

-- Política: Solo admins y RC Abogados pueden ver logs
CREATE POLICY "Admins and RC can view all audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'rc_abogados')
    )
  );

-- Política: Todos pueden insertar logs (para tracking automático)
CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Función helper para registrar acciones
CREATE OR REPLACE FUNCTION log_audit_action(
  p_user_id uuid,
  p_user_email text,
  p_action text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_entity_name text DEFAULT NULL,
  p_old_value jsonb DEFAULT NULL,
  p_new_value jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid AS $$
DECLARE
  v_audit_id uuid;
BEGIN
  INSERT INTO audit_logs (
    user_id,
    user_email,
    action,
    entity_type,
    entity_id,
    entity_name,
    old_value,
    new_value,
    metadata,
    details
  ) VALUES (
    p_user_id,
    p_user_email,
    p_action,
    p_entity_type,
    p_entity_id,
    p_entity_name,
    p_old_value,
    p_new_value,
    p_metadata,
    COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vista simplificada para consultas comunes
CREATE OR REPLACE VIEW audit_logs_detailed AS
SELECT 
  al.id,
  al.user_id,
  al.user_email,
  up.full_name as user_name,
  up.role as user_role,
  al.action,
  al.entity_type,
  al.entity_id,
  al.entity_name,
  al.old_value,
  al.new_value,
  al.metadata,
  al.created_at,
  al.document_id
FROM audit_logs al
LEFT JOIN user_profiles up ON al.user_id = up.id
ORDER BY al.created_at DESC;

-- Comentarios para documentación
COMMENT ON FUNCTION log_audit_action IS 'Función helper para registrar acciones de auditoría en el sistema';
COMMENT ON VIEW audit_logs_detailed IS 'Vista detallada de logs de auditoría con información del usuario';
