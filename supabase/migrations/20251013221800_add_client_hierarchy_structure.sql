/*
  # Reestructuración Jerárquica: Cliente → Sociedad → Categoría → Documentos
  
  ## Descripción
  Sistema de gestión documental con estructura jerárquica completa basada en:
  1. CLIENTES - Nivel superior de organización
  2. SOCIEDADES/ENTIDADES - Empresas bajo cada cliente (RUT + Tipo de sociedad)
  3. CATEGORÍAS - Tipos de documentos según árbol de requisitos
  4. DOCUMENTOS - Documentos individuales con estado de completitud

  ## Nuevas Tablas
  
  1. **clients** - Clientes principales del sistema
  2. **entity_types** - Tipos de sociedades/entidades (catálogo)
  3. **entities** - Sociedades/entidades de cada cliente
  4. **document_categories** - Categorías jerárquicas de documentos
  5. **required_documents** - Documentos requeridos por categoría y tipo de entidad
  6. **entity_documents** - Documentos subidos para cada entidad
  7. **document_reminders** - Sistema de recordatorios y alertas
  
  ## Roles de Usuario
  - **admin** - Acceso total a todo el sistema
  - **rc_abogados** - Acceso a todos los clientes y sus sociedades
  - **cliente** - Acceso solo a sus propias sociedades y documentos

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Políticas restrictivas por rol
  - Control granular por cliente
*/

-- ============================================================================
-- 1. TABLA DE CLIENTES
-- ============================================================================

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rut text UNIQUE,
  email text,
  phone text,
  address text,
  contact_person text,
  notes text DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. TABLA DE TIPOS DE ENTIDADES/SOCIEDADES
-- ============================================================================

CREATE TABLE IF NOT EXISTS entity_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  parent_id uuid REFERENCES entity_types(id) ON DELETE CASCADE,
  display_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE entity_types ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. TABLA DE SOCIEDADES/ENTIDADES
-- ============================================================================

CREATE TABLE IF NOT EXISTS entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  entity_type_id uuid NOT NULL REFERENCES entity_types(id) ON DELETE RESTRICT,
  name text NOT NULL, -- Razón Social
  rut text NOT NULL,
  legal_representative text,
  address text,
  notes text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, rut)
);

ALTER TABLE entities ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. TABLA DE CATEGORÍAS DE DOCUMENTOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  parent_id uuid REFERENCES document_categories(id) ON DELETE CASCADE,
  display_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. TABLA DE DOCUMENTOS REQUERIDOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS required_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES document_categories(id) ON DELETE CASCADE,
  entity_type_id uuid REFERENCES entity_types(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  is_required boolean DEFAULT true, -- true = obligatorio, false = opcional
  display_order int DEFAULT 0,
  validation_rules jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE required_documents ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. TABLA DE DOCUMENTOS SUBIDOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS entity_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  required_document_id uuid REFERENCES required_documents(id) ON DELETE SET NULL,
  category_id uuid NOT NULL REFERENCES document_categories(id) ON DELETE RESTRICT,
  
  -- Información del archivo
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL,
  
  -- Metadatos
  title text NOT NULL,
  description text DEFAULT '',
  notes text DEFAULT '',
  version int NOT NULL DEFAULT 1,
  
  -- Estado y validación
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  expiration_date date,
  
  -- Auditoría
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploaded_at timestamptz DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text DEFAULT '',
  
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE entity_documents ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. TABLA DE RECORDATORIOS Y ALERTAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  required_document_id uuid NOT NULL REFERENCES required_documents(id) ON DELETE CASCADE,
  
  reminder_type text NOT NULL CHECK (reminder_type IN ('missing', 'expiring', 'expired')),
  message text NOT NULL,
  due_date date,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  is_resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  created_at timestamptz DEFAULT now()
);

ALTER TABLE document_reminders ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. TABLA DE RELACIÓN CLIENTE-USUARIO (para usuarios tipo "cliente")
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at timestamptz DEFAULT now(),
  UNIQUE(client_id, user_id)
);

ALTER TABLE client_users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLÍTICAS RLS - CLIENTS
-- ============================================================================

CREATE POLICY "Admins y RC Abogados ven todos los clientes"
  ON clients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'rc_abogados')
    )
  );

CREATE POLICY "Clientes ven sus propios clientes asignados"
  ON clients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_users
      WHERE client_users.client_id = clients.id
      AND client_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins y RC Abogados crean clientes"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'rc_abogados')
    )
  );

CREATE POLICY "Admins y RC Abogados actualizan clientes"
  ON clients FOR UPDATE
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

CREATE POLICY "Solo admins eliminan clientes"
  ON clients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- ============================================================================
-- POLÍTICAS RLS - ENTITY_TYPES
-- ============================================================================

CREATE POLICY "Todos los autenticados ven tipos de entidad"
  ON entity_types FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Solo admins gestionan tipos de entidad"
  ON entity_types FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- ============================================================================
-- POLÍTICAS RLS - ENTITIES
-- ============================================================================

CREATE POLICY "Admins y RC Abogados ven todas las entidades"
  ON entities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'rc_abogados')
    )
  );

CREATE POLICY "Clientes ven entidades de sus clientes asignados"
  ON entities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_users
      WHERE client_users.client_id = entities.client_id
      AND client_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins y RC Abogados crean entidades"
  ON entities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'rc_abogados')
    )
  );

CREATE POLICY "Admins y RC Abogados actualizan entidades"
  ON entities FOR UPDATE
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

CREATE POLICY "Solo admins eliminan entidades"
  ON entities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- ============================================================================
-- POLÍTICAS RLS - DOCUMENT_CATEGORIES
-- ============================================================================

CREATE POLICY "Todos los autenticados ven categorías de documentos"
  ON document_categories FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Solo admins gestionan categorías de documentos"
  ON document_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- ============================================================================
-- POLÍTICAS RLS - REQUIRED_DOCUMENTS
-- ============================================================================

CREATE POLICY "Todos los autenticados ven documentos requeridos"
  ON required_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins gestionan documentos requeridos"
  ON required_documents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- ============================================================================
-- POLÍTICAS RLS - ENTITY_DOCUMENTS
-- ============================================================================

CREATE POLICY "Admins y RC Abogados ven todos los documentos"
  ON entity_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'rc_abogados')
    )
  );

CREATE POLICY "Clientes ven documentos de sus entidades"
  ON entity_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entities e
      JOIN client_users cu ON cu.client_id = e.client_id
      WHERE e.id = entity_documents.entity_id
      AND cu.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuarios autenticados suben documentos a entidades autorizadas"
  ON entity_documents FOR INSERT
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
      WHERE e.id = entity_documents.entity_id
      AND cu.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins y RC Abogados actualizan documentos"
  ON entity_documents FOR UPDATE
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

CREATE POLICY "Propietarios eliminan sus documentos"
  ON entity_documents FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'rc_abogados')
    )
  );

-- ============================================================================
-- POLÍTICAS RLS - DOCUMENT_REMINDERS
-- ============================================================================

CREATE POLICY "Admins y RC Abogados ven todos los recordatorios"
  ON document_reminders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'rc_abogados')
    )
  );

CREATE POLICY "Clientes ven recordatorios de sus entidades"
  ON document_reminders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entities e
      JOIN client_users cu ON cu.client_id = e.client_id
      WHERE e.id = document_reminders.entity_id
      AND cu.user_id = auth.uid()
    )
  );

CREATE POLICY "Sistema crea recordatorios automáticamente"
  ON document_reminders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autorizados resuelven recordatorios"
  ON document_reminders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'rc_abogados')
    )
    OR EXISTS (
      SELECT 1 FROM entities e
      JOIN client_users cu ON cu.client_id = e.client_id
      WHERE e.id = document_reminders.entity_id
      AND cu.user_id = auth.uid()
    )
  )
  WITH CHECK (true);

-- ============================================================================
-- POLÍTICAS RLS - CLIENT_USERS
-- ============================================================================

CREATE POLICY "Admins y RC Abogados ven todas las asignaciones"
  ON client_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'rc_abogados')
    )
  );

CREATE POLICY "Usuarios ven sus propias asignaciones"
  ON client_users FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins y RC Abogados gestionan asignaciones"
  ON client_users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'rc_abogados')
    )
  );

-- ============================================================================
-- ACTUALIZAR TABLA user_profiles PARA INCLUIR NUEVO ROL
-- ============================================================================

DO $$
BEGIN
  -- Eliminar constraint existente si existe
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_profiles_role_check'
    AND table_name = 'user_profiles'
  ) THEN
    ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_role_check;
  END IF;
END $$;

ALTER TABLE user_profiles 
  ADD CONSTRAINT user_profiles_role_check 
  CHECK (role IN ('user', 'cliente', 'rc_abogados', 'admin'));

-- ============================================================================
-- ÍNDICES PARA MEJORAR RENDIMIENTO
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_entities_client ON entities(client_id);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type_id);
CREATE INDEX IF NOT EXISTS idx_entity_documents_entity ON entity_documents(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_documents_category ON entity_documents(category_id);
CREATE INDEX IF NOT EXISTS idx_entity_documents_required ON entity_documents(required_document_id);
CREATE INDEX IF NOT EXISTS idx_entity_documents_status ON entity_documents(status);
CREATE INDEX IF NOT EXISTS idx_entity_documents_uploaded_at ON entity_documents(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_reminders_entity ON document_reminders(entity_id);
CREATE INDEX IF NOT EXISTS idx_document_reminders_resolved ON document_reminders(is_resolved);
CREATE INDEX IF NOT EXISTS idx_client_users_client ON client_users(client_id);
CREATE INDEX IF NOT EXISTS idx_client_users_user ON client_users(user_id);
CREATE INDEX IF NOT EXISTS idx_required_documents_category ON required_documents(category_id);
CREATE INDEX IF NOT EXISTS idx_required_documents_entity_type ON required_documents(entity_type_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger para actualizar updated_at en clients
DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Trigger para actualizar updated_at en entities
DROP TRIGGER IF EXISTS update_entities_updated_at ON entities;
CREATE TRIGGER update_entities_updated_at
  BEFORE UPDATE ON entities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- DATOS INICIALES - TIPOS DE ENTIDADES (basado en documento adjunto)
-- ============================================================================

INSERT INTO entity_types (code, name, description, display_order) VALUES
  ('SA', 'Sociedad Anónima', 'Sociedad Anónima', 1),
  ('SPA', 'Sociedad por Acciones', 'Sociedad por Acciones', 2),
  ('LTDA', 'Sociedad de Responsabilidad Limitada', 'Sociedad de Responsabilidad Limitada', 3),
  ('COLECTIVA', 'Sociedad Colectiva', 'Sociedad Colectiva', 4),
  ('COMANDITA_SIMPLE', 'Sociedad en Comandita Simple', 'Sociedad en Comandita Simple', 5),
  ('COMANDITA_ACCIONES', 'Sociedad en Comandita por Acciones', 'Sociedad en Comandita por Acciones', 6),
  ('EIRL', 'Empresa Individual de Responsabilidad Limitada', 'EIRL', 7),
  ('PERSONA_NATURAL', 'Persona Natural', 'Persona Natural', 8),
  ('FUNDACION', 'Fundación', 'Fundación sin fines de lucro', 9),
  ('CORPORACION', 'Corporación', 'Corporación sin fines de lucro', 10),
  ('COOPERATIVA', 'Cooperativa', 'Cooperativa', 11),
  ('COMUNIDAD', 'Comunidad', 'Comunidad', 12),
  ('AGENCIA_EXTRANJERA', 'Agencia de Sociedad Extranjera', 'Agencia de Sociedad Extranjera', 13),
  ('OTRO', 'Otro', 'Otro tipo de entidad', 99)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- DATOS INICIALES - CATEGORÍAS DE DOCUMENTOS
-- ============================================================================

INSERT INTO document_categories (code, name, description, display_order) VALUES
  ('LEGAL', 'Documentos Legales', 'Documentos legales y constitutivos', 1),
  ('TRIBUTARIO', 'Documentos Tributarios', 'Documentos tributarios y fiscales', 2),
  ('LABORAL', 'Documentos Laborales', 'Documentos de recursos humanos y laboral', 3),
  ('FINANCIERO', 'Documentos Financieros', 'Estados financieros y contables', 4),
  ('PROPIEDAD', 'Documentos de Propiedad', 'Títulos y documentos de propiedad', 5),
  ('ADMINISTRATIVO', 'Documentos Administrativos', 'Documentos administrativos generales', 6),
  ('CONTRATOS', 'Contratos', 'Contratos y acuerdos', 7),
  ('PODERES', 'Poderes y Mandatos', 'Poderes y documentos de representación', 8),
  ('REGISTRO', 'Registros', 'Certificados y registros oficiales', 9),
  ('OTRO', 'Otros Documentos', 'Otros documentos no clasificados', 99)
ON CONFLICT (code) DO NOTHING;