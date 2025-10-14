/*
  # Sistema de Notificaciones

  ## Descripción
  Sistema completo de notificaciones en tiempo real para eventos importantes.

  ## Nuevas Tablas
  
  ### `notifications`
  - `id` (uuid, primary key)
  - `user_id` (uuid) - Usuario destinatario
  - `title` (text) - Título de la notificación
  - `message` (text) - Mensaje completo
  - `type` (text) - Tipo de notificación
  - `entity_type` (text) - Tipo de entidad relacionada
  - `entity_id` (uuid) - ID de la entidad relacionada
  - `entity_name` (text) - Nombre de la entidad
  - `is_read` (boolean) - Si fue leída
  - `read_at` (timestamptz) - Fecha de lectura
  - `metadata` (jsonb) - Datos adicionales
  - `created_at` (timestamptz)

  ## Seguridad
  - RLS habilitado
  - Usuarios solo ven sus propias notificaciones
*/

-- Crear tabla de notificaciones
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  entity_type text,
  entity_id uuid,
  entity_name text,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entity_type, entity_id);

-- Habilitar RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios solo ven sus notificaciones
CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Política: Sistema puede crear notificaciones
CREATE POLICY "System can create notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política: Usuarios pueden actualizar sus notificaciones (marcar como leído)
CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuarios pueden eliminar sus notificaciones
CREATE POLICY "Users can delete own notifications"
  ON notifications
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Función para crear notificación
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_entity_name text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    entity_type,
    entity_id,
    entity_name,
    metadata
  ) VALUES (
    p_user_id,
    p_title,
    p_message,
    p_type,
    p_entity_type,
    p_entity_id,
    p_entity_name,
    p_metadata
  ) RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para marcar notificación como leída
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE notifications
  SET is_read = true, read_at = now()
  WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para marcar todas como leídas
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS void AS $$
BEGIN
  UPDATE notifications
  SET is_read = true, read_at = now()
  WHERE user_id = auth.uid() AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para contar notificaciones no leídas
CREATE OR REPLACE FUNCTION count_unread_notifications()
RETURNS integer AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*)::integer INTO v_count
  FROM notifications
  WHERE user_id = auth.uid() AND is_read = false;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios
COMMENT ON TABLE notifications IS 'Sistema de notificaciones en tiempo real';
COMMENT ON FUNCTION create_notification IS 'Crear una nueva notificación para un usuario';
COMMENT ON FUNCTION mark_notification_read IS 'Marcar una notificación como leída';
COMMENT ON FUNCTION mark_all_notifications_read IS 'Marcar todas las notificaciones como leídas';
COMMENT ON FUNCTION count_unread_notifications IS 'Contar notificaciones no leídas del usuario actual';
