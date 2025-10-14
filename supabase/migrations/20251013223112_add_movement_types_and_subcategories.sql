/*
  # Agregar Tipos de Movimiento y Subcategorías
  
  ## Descripción
  Se agregan los conceptos de:
  - Tipos de Movimiento (Constitución, Modificación, Funcionamiento)
  - Movimientos por entidad (cada movimiento tiene una fecha)
  - Subcategorías específicas por tipo de movimiento
  - Documentos requeridos vinculados a movimientos específicos
  
  ## Nuevas Tablas
  1. **movement_types** - Tipos de movimiento (Constitución, Modificación, Funcionamiento)
  2. **entity_movements** - Movimientos creados para cada entidad
  3. **movement_subcategories** - Subcategorías por tipo de movimiento
  
  ## Cambios en Tablas Existentes
  - entity_documents: se agrega relación a movement y subcategory
  - required_documents: se agrega relación a movement_type y subcategory
*/

-- ============================================================================
-- 1. TABLA DE TIPOS DE MOVIMIENTO
-- ============================================================================

CREATE TABLE IF NOT EXISTS movement_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  display_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE movement_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos los autenticados ven tipos de movimiento"
  ON movement_types FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Solo admins gestionan tipos de movimiento"
  ON movement_types FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- ============================================================================
-- 2. TABLA DE SUBCATEGORÍAS DE MOVIMIENTO
-- ============================================================================

CREATE TABLE IF NOT EXISTS movement_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_type_id uuid NOT NULL REFERENCES movement_types(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  display_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(movement_type_id, code)
);

ALTER TABLE movement_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos los autenticados ven subcategorías"
  ON movement_subcategories FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Solo admins gestionan subcategorías"
  ON movement_subcategories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- ============================================================================
-- 3. TABLA DE MOVIMIENTOS POR ENTIDAD
-- ============================================================================

CREATE TABLE IF NOT EXISTS entity_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  movement_type_id uuid NOT NULL REFERENCES movement_types(id) ON DELETE RESTRICT,
  subcategory_id uuid REFERENCES movement_subcategories(id) ON DELETE SET NULL,
  document_date date NOT NULL,
  description text DEFAULT '',
  notes text DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE entity_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins y RC Abogados ven todos los movimientos"
  ON entity_movements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'rc_abogados')
    )
  );

CREATE POLICY "Clientes ven movimientos de sus entidades"
  ON entity_movements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entities e
      JOIN client_users cu ON cu.client_id = e.client_id
      WHERE e.id = entity_movements.entity_id
      AND cu.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuarios autorizados crean movimientos"
  ON entity_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'rc_abogados')
    )
    OR EXISTS (
      SELECT 1 FROM entities e
      JOIN client_users cu ON cu.client_id = e.client_id
      WHERE e.id = entity_movements.entity_id
      AND cu.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins y RC Abogados actualizan movimientos"
  ON entity_movements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'rc_abogados')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'rc_abogados')
    )
  );

-- ============================================================================
-- 4. MODIFICAR TABLA entity_documents PARA AGREGAR MOVIMIENTO
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entity_documents' 
    AND column_name = 'movement_id'
  ) THEN
    ALTER TABLE entity_documents 
      ADD COLUMN movement_id uuid REFERENCES entity_movements(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entity_documents' 
    AND column_name = 'subcategory_id'
  ) THEN
    ALTER TABLE entity_documents 
      ADD COLUMN subcategory_id uuid REFERENCES movement_subcategories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 5. MODIFICAR required_documents PARA VINCULAR A MOVIMIENTO Y SUBCATEGORÍA
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'required_documents' 
    AND column_name = 'movement_type_id'
  ) THEN
    ALTER TABLE required_documents 
      ADD COLUMN movement_type_id uuid REFERENCES movement_types(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'required_documents' 
    AND column_name = 'subcategory_id'
  ) THEN
    ALTER TABLE required_documents 
      ADD COLUMN subcategory_id uuid REFERENCES movement_subcategories(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- ÍNDICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_entity_movements_entity ON entity_movements(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_movements_type ON entity_movements(movement_type_id);
CREATE INDEX IF NOT EXISTS idx_entity_movements_subcategory ON entity_movements(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_entity_documents_movement ON entity_documents(movement_id);
CREATE INDEX IF NOT EXISTS idx_entity_documents_subcategory ON entity_documents(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_movement_subcategories_type ON movement_subcategories(movement_type_id);
CREATE INDEX IF NOT EXISTS idx_required_documents_movement_type ON required_documents(movement_type_id);
CREATE INDEX IF NOT EXISTS idx_required_documents_subcategory ON required_documents(subcategory_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS update_entity_movements_updated_at ON entity_movements;
CREATE TRIGGER update_entity_movements_updated_at
  BEFORE UPDATE ON entity_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- DATOS INICIALES - TIPOS DE MOVIMIENTO
-- ============================================================================

INSERT INTO movement_types (code, name, description, display_order) VALUES
  ('CONSTITUCION', 'Constitución', 'Constitución de la entidad', 1),
  ('MODIFICACION', 'Modificación', 'Modificaciones estatutarias o societarias', 2),
  ('FUNCIONAMIENTO', 'Funcionamiento', 'Documentos de funcionamiento operativo', 3)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- DATOS INICIALES - ACTUALIZAR TIPOS DE ENTIDAD (AGREGAR VARIANTES RES)
-- ============================================================================

INSERT INTO entity_types (code, name, description, display_order) VALUES
  ('SA_RES', 'Sociedad Anónima (RES)', 'Sociedad Anónima Régimen Especial Simplificado', 14),
  ('SPA_RES', 'Sociedad por Acciones (RES)', 'Sociedad por Acciones Régimen Especial Simplificado', 15),
  ('LTDA_RES', 'Sociedad de Responsabilidad Limitada (RES)', 'Sociedad de Responsabilidad Limitada Régimen Especial Simplificado', 16)
ON CONFLICT (code) DO NOTHING;