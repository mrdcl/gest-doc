/*
  # Restore Active Clients

  1. Changes
    - Set is_active = true for all existing clients that have NULL
    - Set is_active = true for all existing entities that have NULL
    - Ensure all existing data is visible after adding the filter

  2. Purpose
    - Restore visibility of existing clients
    - Ensure backward compatibility with existing data
*/

-- Update all clients with NULL is_active to true
UPDATE clients
SET is_active = true
WHERE is_active IS NULL;

-- Update all entities with NULL is_active to true
UPDATE entities
SET is_active = true
WHERE is_active IS NULL;

-- Ensure the default is always applied
ALTER TABLE clients
  ALTER COLUMN is_active SET DEFAULT true;

ALTER TABLE entities
  ALTER COLUMN is_active SET DEFAULT true;

-- Add NOT NULL constraint after setting defaults
ALTER TABLE clients
  ALTER COLUMN is_active SET NOT NULL;

ALTER TABLE entities
  ALTER COLUMN is_active SET NOT NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_clients_is_active
  ON clients(is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_entities_is_active
  ON entities(is_active)
  WHERE is_active = true;
