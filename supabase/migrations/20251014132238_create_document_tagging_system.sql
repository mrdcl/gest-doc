/*
  # Sistema de Etiquetas de Documentos

  ## Descripción
  Sistema completo de etiquetado para organizar y categorizar documentos.

  ## Nuevas Tablas
  
  ### `tags`
  - `id` (uuid, primary key)
  - `name` (text) - Nombre de la etiqueta
  - `color` (text) - Color en hexadecimal
  - `description` (text) - Descripción opcional
  - `created_by` (uuid) - Usuario que creó la etiqueta
  - `created_at` (timestamptz)

  ### `document_tags`
  - `id` (uuid, primary key)
  - `document_id` (uuid) - Documento
  - `tag_id` (uuid) - Etiqueta
  - `tagged_by` (uuid) - Usuario que etiquetó
  - `tagged_at` (timestamptz)

  ## Seguridad
  - RLS habilitado
  - Todos pueden ver etiquetas
  - Solo Admin y RC Abogados pueden crear/editar etiquetas
  - Todos pueden asignar etiquetas a documentos
*/

-- Crear tabla de etiquetas
CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6',
  description text DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Crear tabla de relación documento-etiqueta
CREATE TABLE IF NOT EXISTS document_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES entity_documents(id) ON DELETE CASCADE NOT NULL,
  tag_id uuid REFERENCES tags(id) ON DELETE CASCADE NOT NULL,
  tagged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  tagged_at timestamptz DEFAULT now(),
  UNIQUE(document_id, tag_id)
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_created_by ON tags(created_by);
CREATE INDEX IF NOT EXISTS idx_document_tags_document ON document_tags(document_id);
CREATE INDEX IF NOT EXISTS idx_document_tags_tag ON document_tags(tag_id);

-- Habilitar RLS
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_tags ENABLE ROW LEVEL SECURITY;

-- Políticas para tags
CREATE POLICY "Everyone can view tags"
  ON tags
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and RC can create tags"
  ON tags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'rc_abogados')
    )
  );

CREATE POLICY "Admin and RC can update tags"
  ON tags
  FOR UPDATE
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

CREATE POLICY "Admin and RC can delete tags"
  ON tags
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'rc_abogados')
    )
  );

-- Políticas para document_tags
CREATE POLICY "Users can view document tags based on document access"
  ON document_tags
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entity_documents ed
      JOIN entities e ON ed.entity_id = e.id
      JOIN client_users cu ON cu.client_id = e.client_id
      WHERE ed.id = document_tags.document_id
      AND (
        cu.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.id = auth.uid()
          AND up.role IN ('admin', 'rc_abogados')
        )
      )
    )
  );

CREATE POLICY "Authenticated users can tag documents"
  ON document_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM entity_documents ed
      JOIN entities e ON ed.entity_id = e.id
      JOIN client_users cu ON cu.client_id = e.client_id
      WHERE ed.id = document_tags.document_id
      AND (
        cu.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.id = auth.uid()
          AND up.role IN ('admin', 'rc_abogados')
        )
      )
    )
    AND auth.uid() = tagged_by
  );

CREATE POLICY "Users can remove tags from documents"
  ON document_tags
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entity_documents ed
      JOIN entities e ON ed.entity_id = e.id
      JOIN client_users cu ON cu.client_id = e.client_id
      WHERE ed.id = document_tags.document_id
      AND (
        cu.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.id = auth.uid()
          AND up.role IN ('admin', 'rc_abogados')
        )
      )
    )
  );

-- Vista para documentos con sus etiquetas
CREATE OR REPLACE VIEW documents_with_tags AS
SELECT 
  ed.id as document_id,
  ed.title,
  ed.file_name,
  COALESCE(
    json_agg(
      json_build_object(
        'id', t.id,
        'name', t.name,
        'color', t.color,
        'description', t.description
      )
    ) FILTER (WHERE t.id IS NOT NULL),
    '[]'::json
  ) as tags
FROM entity_documents ed
LEFT JOIN document_tags dt ON ed.id = dt.document_id
LEFT JOIN tags t ON dt.tag_id = t.id
GROUP BY ed.id, ed.title, ed.file_name;

-- Comentarios
COMMENT ON TABLE tags IS 'Etiquetas para organizar documentos';
COMMENT ON TABLE document_tags IS 'Relación many-to-many entre documentos y etiquetas';
COMMENT ON VIEW documents_with_tags IS 'Vista de documentos con sus etiquetas agregadas';
