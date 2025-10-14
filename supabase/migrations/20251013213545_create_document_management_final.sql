/*
  # Esquema de Gestión Documental Corporativa

  ## Descripción
  Sistema completo de gestión documental con control de acceso, categorización,
  versionado y auditoría.

  ## Nuevas Tablas
  
  1. **user_profiles** - Perfiles de usuarios con roles
  2. **categories** - Categorías jerárquicas de documentos
  3. **documents** - Documentos principales con metadatos
  4. **document_access** - Control de acceso granular
  5. **document_versions** - Historial completo de versiones
  6. **audit_logs** - Registro detallado de auditoría

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Políticas restrictivas por defecto
  - Control granular de permisos
*/

-- Crear extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de perfiles de usuario
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  department text DEFAULT '',
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'manager', 'admin')),
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven su propio perfil"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Usuarios actualizan su propio perfil"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Usuarios crean su propio perfil"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- 2. Tabla de categorías
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  parent_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categorías visibles para autenticados"
  ON categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Administradores gestionan categorías"
  ON categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- 3. Tabla de documentos (sin políticas que referencien document_access)
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 4. Tabla de control de acceso
CREATE TABLE IF NOT EXISTS document_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL DEFAULT 'read' CHECK (permission IN ('read', 'write', 'admin')),
  granted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at timestamptz DEFAULT now(),
  UNIQUE(document_id, user_id)
);

ALTER TABLE document_access ENABLE ROW LEVEL SECURITY;

-- 5. Ahora creamos las políticas de documents que referencian document_access
CREATE POLICY "Usuarios ven documentos propios o compartidos"
  ON documents FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR status = 'published'
    OR EXISTS (
      SELECT 1 FROM document_access
      WHERE document_access.document_id = documents.id
      AND document_access.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuarios crean documentos"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Propietarios actualizan documentos"
  ON documents FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM document_access
      WHERE document_access.document_id = documents.id
      AND document_access.user_id = auth.uid()
      AND document_access.permission IN ('write', 'admin')
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM document_access
      WHERE document_access.document_id = documents.id
      AND document_access.user_id = auth.uid()
      AND document_access.permission IN ('write', 'admin')
    )
  );

CREATE POLICY "Propietarios eliminan documentos"
  ON documents FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- Políticas para document_access
CREATE POLICY "Usuarios ven sus permisos"
  ON document_access FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_access.document_id
      AND documents.owner_id = auth.uid()
    )
  );

CREATE POLICY "Propietarios gestionan permisos"
  ON document_access FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_access.document_id
      AND documents.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_access.document_id
      AND documents.owner_id = auth.uid()
    )
  );

-- 6. Tabla de versiones
CREATE TABLE IF NOT EXISTS document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version int NOT NULL DEFAULT 1,
  file_path text NOT NULL,
  changes text DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven versiones de documentos accesibles"
  ON document_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_versions.document_id
      AND (
        documents.owner_id = auth.uid()
        OR documents.status = 'published'
        OR EXISTS (
          SELECT 1 FROM document_access
          WHERE document_access.document_id = documents.id
          AND document_access.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Usuarios crean versiones de documentos autorizados"
  ON document_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_versions.document_id
      AND (
        documents.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM document_access
          WHERE document_access.document_id = documents.id
          AND document_access.user_id = auth.uid()
          AND document_access.permission IN ('write', 'admin')
        )
      )
    )
  );

-- 7. Tabla de auditoría
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('view', 'download', 'edit', 'delete', 'share', 'upload')),
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Administradores ven logs de auditoría"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Usuarios crean logs de auditoría"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_document_access_user ON document_access(user_id);
CREATE INDEX IF NOT EXISTS idx_document_access_document ON document_access(document_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_document ON audit_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at en documents
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Insertar categorías iniciales
INSERT INTO categories (name, description) VALUES
  ('Contratos', 'Documentos contractuales y acuerdos legales'),
  ('Facturas', 'Facturas y documentos contables'),
  ('Recursos Humanos', 'Documentos de personal y nómina'),
  ('Proyectos', 'Documentación de proyectos'),
  ('Políticas', 'Políticas y procedimientos corporativos'),
  ('Reportes', 'Reportes y análisis'),
  ('General', 'Documentos generales y misceláneos')
ON CONFLICT DO NOTHING;