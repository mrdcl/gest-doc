/*
  # Add Missing Entity Fields

  1. Changes
    - Add email, phone, tax_regime, business_activity to entities table
    - These fields are needed for comprehensive entity management

  2. Purpose
    - Support full entity editing functionality
    - Store complete entity information
*/

-- Add missing columns to entities table
ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS tax_regime text,
  ADD COLUMN IF NOT EXISTS business_activity text;

-- Add comments for documentation
COMMENT ON COLUMN entities.email IS 'Email de contacto de la entidad';
COMMENT ON COLUMN entities.phone IS 'Teléfono de contacto de la entidad';
COMMENT ON COLUMN entities.tax_regime IS 'Régimen tributario (ej: Renta Presunta, 14 ter A)';
COMMENT ON COLUMN entities.business_activity IS 'Giro o actividad comercial de la entidad';
