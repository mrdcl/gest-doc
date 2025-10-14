/*
  # Configuración de Documentos Requeridos por Tipo de Entidad y Movimiento
  
  ## Descripción
  Configura el sistema de documentos requeridos vinculados a:
  - Tipo de entidad (sociedad)
  - Tipo de movimiento (Constitución, Modificación, Funcionamiento)
  
  ## Cambios
  1. Actualiza la tabla required_documents para vincular con entity_type
  2. Agrega campo is_optional para distinguir documentos obligatorios
*/

-- ============================================================================
-- 1. MODIFICAR required_documents PARA VINCULAR CON entity_type
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'required_documents' 
    AND column_name = 'entity_type_id'
  ) THEN
    ALTER TABLE required_documents 
      ADD COLUMN entity_type_id uuid REFERENCES entity_types(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 2. AGREGAR CAMPO is_optional A required_documents
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'required_documents' 
    AND column_name = 'is_optional'
  ) THEN
    ALTER TABLE required_documents 
      ADD COLUMN is_optional boolean DEFAULT false;
  END IF;
END $$;

-- ============================================================================
-- 3. CREAR ÍNDICES ADICIONALES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_required_documents_entity_type ON required_documents(entity_type_id);

-- ============================================================================
-- 4. DATOS BASE - DOCUMENTOS GENÉRICOS POR TIPO DE MOVIMIENTO
-- ============================================================================

DO $$
DECLARE
  constitucion_id uuid;
  modificacion_id uuid;
BEGIN
  SELECT id INTO constitucion_id FROM movement_types WHERE code = 'CONSTITUCION';
  SELECT id INTO modificacion_id FROM movement_types WHERE code = 'MODIFICACION';

  -- Documentos de Constitución (genéricos para todos los tipos)
  INSERT INTO required_documents (
    movement_type_id, 
    name, 
    description, 
    is_required, 
    is_optional,
    display_order
  ) VALUES
    (constitucion_id, 'Escritura de Constitución', 'Escritura pública de constitución de la sociedad', true, false, 1),
    (constitucion_id, 'Publicación en Diario Oficial', 'Extracto publicado en el Diario Oficial', true, false, 2),
    (constitucion_id, 'Inscripción en Registro de Comercio', 'Certificado de inscripción en el Registro de Comercio', true, false, 3),
    (constitucion_id, 'RUT Social', 'Rol Único Tributario de la sociedad', true, false, 4),
    (constitucion_id, 'Inicio de Actividades (Formulario 4415)', 'Formulario de inicio de actividades ante el SII', true, false, 5),
    (constitucion_id, 'Cédula de Identidad Socios/Accionistas', 'Cédulas de identidad de socios o accionistas', true, false, 6),
    (constitucion_id, 'Estatutos Sociales', 'Estatutos sociales de la entidad', true, false, 7),
    (constitucion_id, 'Protocolización de Junta', 'Acta de junta constitutiva protocolizada', false, true, 8)
  ON CONFLICT DO NOTHING;

  -- Documentos de Modificación
  INSERT INTO required_documents (
    movement_type_id, 
    name, 
    description, 
    is_required, 
    is_optional,
    display_order
  ) VALUES
    (modificacion_id, 'Escritura de Modificación', 'Escritura pública de modificación estatutaria', true, false, 1),
    (modificacion_id, 'Publicación en Diario Oficial', 'Extracto de modificación publicado', true, false, 2),
    (modificacion_id, 'Inscripción en Registro de Comercio', 'Certificado de inscripción de la modificación', true, false, 3),
    (modificacion_id, 'Acta de Junta', 'Acta de junta que aprueba la modificación', true, false, 4),
    (modificacion_id, 'Certificado de Vigencia', 'Certificado de vigencia de la sociedad', false, true, 5)
  ON CONFLICT DO NOTHING;

END $$;

-- ============================================================================
-- 5. VISTA PARA FACILITAR CONSULTAS DE COMPLETITUD
-- ============================================================================

CREATE OR REPLACE VIEW movement_completion_status AS
SELECT 
  em.id as movement_id,
  em.entity_id,
  em.movement_type_id,
  e.entity_type_id,
  COUNT(DISTINCT rd.id) as required_documents_count,
  COUNT(DISTINCT CASE WHEN rd.is_optional = false THEN rd.id END) as required_mandatory_count,
  COUNT(DISTINCT ed.id) as uploaded_documents_count,
  COUNT(DISTINCT CASE WHEN rd.is_optional = false AND ed.id IS NOT NULL THEN rd.id END) as uploaded_mandatory_count,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN rd.is_optional = false THEN rd.id END) = 0 THEN 100
    ELSE ROUND(
      (COUNT(DISTINCT CASE WHEN rd.is_optional = false AND ed.id IS NOT NULL THEN rd.id END)::numeric / 
       COUNT(DISTINCT CASE WHEN rd.is_optional = false THEN rd.id END)::numeric) * 100
    )
  END as completion_percentage
FROM entity_movements em
JOIN entities e ON e.id = em.entity_id
LEFT JOIN required_documents rd ON (
  rd.movement_type_id = em.movement_type_id 
  AND (rd.entity_type_id IS NULL OR rd.entity_type_id = e.entity_type_id)
)
LEFT JOIN entity_documents ed ON (
  ed.movement_id = em.id 
  AND ed.required_document_id = rd.id
)
GROUP BY em.id, em.entity_id, em.movement_type_id, e.entity_type_id;