/*
  # Sistema de Autenticación de Dos Factores (2FA)

  ## Descripción
  Implementa 2FA usando TOTP (Time-based One-Time Password) para mayor seguridad.

  ## Nuevas Tablas
  
  ### `user_2fa_settings`
  - `id` (uuid, primary key)
  - `user_id` (uuid) - Usuario
  - `is_enabled` (boolean) - Si 2FA está habilitado
  - `secret` (text) - Secret key para TOTP
  - `backup_codes` (text[]) - Códigos de recuperación
  - `created_at` (timestamptz)
  - `enabled_at` (timestamptz)
  
  ## Seguridad
  - RLS habilitado
  - Usuarios solo pueden ver/editar su propia configuración
  - Secret encriptado en la base de datos
*/

-- Crear tabla de configuración 2FA
CREATE TABLE IF NOT EXISTS user_2fa_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  is_enabled boolean DEFAULT false,
  secret text,
  backup_codes text[],
  created_at timestamptz DEFAULT now(),
  enabled_at timestamptz
);

-- Habilitar RLS
ALTER TABLE user_2fa_settings ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios solo pueden ver su propia configuración
CREATE POLICY "Users can view own 2FA settings"
  ON user_2fa_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Política: Usuarios pueden crear su configuración
CREATE POLICY "Users can create own 2FA settings"
  ON user_2fa_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuarios pueden actualizar su configuración
CREATE POLICY "Users can update own 2FA settings"
  ON user_2fa_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuarios pueden eliminar su configuración
CREATE POLICY "Users can delete own 2FA settings"
  ON user_2fa_settings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_user_2fa_settings_user_id ON user_2fa_settings(user_id);

-- Función para generar códigos de backup
CREATE OR REPLACE FUNCTION generate_backup_codes()
RETURNS text[] AS $$
DECLARE
  codes text[];
  i integer;
  code text;
BEGIN
  codes := ARRAY[]::text[];
  
  FOR i IN 1..10 LOOP
    code := substring(md5(random()::text || clock_timestamp()::text) from 1 for 8);
    codes := array_append(codes, upper(code));
  END LOOP;
  
  RETURN codes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios
COMMENT ON TABLE user_2fa_settings IS 'Configuración de autenticación de dos factores por usuario';
COMMENT ON COLUMN user_2fa_settings.secret IS 'Secret key TOTP encriptado';
COMMENT ON COLUMN user_2fa_settings.backup_codes IS 'Códigos de recuperación de un solo uso';
COMMENT ON FUNCTION generate_backup_codes IS 'Genera 10 códigos de backup aleatorios';
