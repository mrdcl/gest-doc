/*
  # Sistema de Papelera de Reciclaje

  ## Descripción
  Implementa soft delete para documentos con papelera de reciclaje.

  ## Cambios
  1. Agregar columnas para soft delete en entity_documents
  2. Actualizar políticas RLS
  3. Crear funciones para restaurar y eliminar permanentemente

  ## Nuevas Columnas
  - deleted_at (timestamptz) - Fecha de eliminación
  - deleted_by (uuid) - Usuario que eliminó
*/

-- Agregar columnas para soft delete
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entity_documents' AND column_name = 'deleted_at') THEN
    ALTER TABLE entity_documents ADD COLUMN deleted_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entity_documents' AND column_name = 'deleted_by') THEN
    ALTER TABLE entity_documents ADD COLUMN deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Índice para documentos eliminados
CREATE INDEX IF NOT EXISTS idx_entity_documents_deleted ON entity_documents(deleted_at) WHERE deleted_at IS NOT NULL;

-- Función para soft delete
CREATE OR REPLACE FUNCTION soft_delete_document(p_document_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE entity_documents
  SET 
    deleted_at = now(),
    deleted_by = auth.uid()
  WHERE id = p_document_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para restaurar documento
CREATE OR REPLACE FUNCTION restore_document(p_document_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE entity_documents
  SET 
    deleted_at = NULL,
    deleted_by = NULL
  WHERE id = p_document_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para eliminar permanentemente
CREATE OR REPLACE FUNCTION permanently_delete_document(p_document_id uuid)
RETURNS void AS $$
DECLARE
  v_file_path text;
BEGIN
  SELECT file_path INTO v_file_path
  FROM entity_documents
  WHERE id = p_document_id AND deleted_at IS NOT NULL;

  IF v_file_path IS NOT NULL THEN
    DELETE FROM entity_documents WHERE id = p_document_id;
  ELSE
    RAISE EXCEPTION 'Document not found in recycle bin';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para auto-limpieza de documentos antiguos
CREATE OR REPLACE FUNCTION cleanup_old_deleted_documents(days_to_keep integer DEFAULT 30)
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH deleted_docs AS (
    DELETE FROM entity_documents
    WHERE deleted_at < now() - (days_to_keep || ' days')::interval
    RETURNING id
  )
  SELECT COUNT(*)::integer INTO deleted_count FROM deleted_docs;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vista de papelera
CREATE OR REPLACE VIEW recycle_bin AS
SELECT 
  ed.*,
  e.name as entity_name,
  c.name as client_name,
  up.full_name as deleted_by_name
FROM entity_documents ed
JOIN entities e ON ed.entity_id = e.id
JOIN clients c ON e.client_id = c.id
LEFT JOIN user_profiles up ON ed.deleted_by = up.id
WHERE ed.deleted_at IS NOT NULL
ORDER BY ed.deleted_at DESC;

-- Comentarios
COMMENT ON FUNCTION soft_delete_document IS 'Marcar documento como eliminado (soft delete)';
COMMENT ON FUNCTION restore_document IS 'Restaurar documento de la papelera';
COMMENT ON FUNCTION permanently_delete_document IS 'Eliminar documento permanentemente';
COMMENT ON FUNCTION cleanup_old_deleted_documents IS 'Limpiar documentos eliminados hace más de N días';
COMMENT ON VIEW recycle_bin IS 'Vista de documentos en papelera de reciclaje';
