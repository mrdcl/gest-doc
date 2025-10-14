/*
  # Demo Data Seeds

  This file creates minimal demo data for testing and development:
  - 1 admin user (admin@example.com)
  - 1 demo category
  - 1 example document

  This seed is idempotent and can be run multiple times safely.
*/

-- Create demo admin user if not exists
DO $$
DECLARE
  demo_user_id uuid;
BEGIN
  -- Check if demo user already exists
  SELECT id INTO demo_user_id
  FROM auth.users
  WHERE email = 'admin@example.com';

  -- If user doesn't exist, create it
  IF demo_user_id IS NULL THEN
    -- Insert into auth.users
    INSERT INTO auth.users (
      id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud
    ) VALUES (
      gen_random_uuid(),
      'admin@example.com',
      crypt('Demo123!Admin', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Demo Admin"}'::jsonb,
      now(),
      now(),
      'authenticated',
      'authenticated'
    )
    RETURNING id INTO demo_user_id;

    -- Create user profile
    INSERT INTO user_profiles (
      id,
      email,
      full_name,
      role,
      is_active,
      created_at
    ) VALUES (
      demo_user_id,
      'admin@example.com',
      'Demo Admin',
      'admin',
      true,
      now()
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Demo admin user created: admin@example.com / Demo123!Admin';
  ELSE
    RAISE NOTICE 'Demo admin user already exists';
  END IF;
END $$;

-- Create demo category if not exists
DO $$
DECLARE
  demo_category_id uuid;
  demo_user_id uuid;
BEGIN
  -- Get demo user id
  SELECT id INTO demo_user_id
  FROM auth.users
  WHERE email = 'admin@example.com';

  -- Check if demo category exists
  SELECT id INTO demo_category_id
  FROM categories
  WHERE name = 'Documentos de Demostración';

  -- Create category if it doesn't exist
  IF demo_category_id IS NULL THEN
    INSERT INTO categories (
      id,
      name,
      description,
      color,
      icon,
      created_by,
      created_at
    ) VALUES (
      gen_random_uuid(),
      'Documentos de Demostración',
      'Categoría de ejemplo para documentos de prueba y demostración del sistema',
      '#3B82F6',
      'folder',
      demo_user_id,
      now()
    )
    RETURNING id INTO demo_category_id;

    RAISE NOTICE 'Demo category created: Documentos de Demostración';
  ELSE
    RAISE NOTICE 'Demo category already exists';
  END IF;
END $$;

-- Create demo entity (sociedad) if not exists
DO $$
DECLARE
  demo_entity_id uuid;
  demo_user_id uuid;
BEGIN
  -- Get demo user id
  SELECT id INTO demo_user_id
  FROM auth.users
  WHERE email = 'admin@example.com';

  -- Check if demo entity exists
  SELECT id INTO demo_entity_id
  FROM entities
  WHERE name = 'Sociedad Demo S.L.';

  -- Create entity if it doesn't exist
  IF demo_entity_id IS NULL THEN
    INSERT INTO entities (
      id,
      name,
      entity_type,
      tax_id,
      description,
      status,
      created_by,
      created_at
    ) VALUES (
      gen_random_uuid(),
      'Sociedad Demo S.L.',
      'sociedad',
      'B12345678',
      'Entidad de demostración para pruebas del sistema de gestión documental',
      'active',
      demo_user_id,
      now()
    )
    RETURNING id INTO demo_entity_id;

    RAISE NOTICE 'Demo entity created: Sociedad Demo S.L.';
  ELSE
    RAISE NOTICE 'Demo entity already exists';
  END IF;
END $$;

-- Create demo document metadata (without actual file in storage)
-- Note: In production, files must be uploaded to Supabase Storage first
-- This creates a metadata-only entry for demonstration purposes
DO $$
DECLARE
  demo_entity_id uuid;
  demo_category_id uuid;
  demo_user_id uuid;
  demo_doc_id uuid;
BEGIN
  -- Get demo user id
  SELECT id INTO demo_user_id
  FROM auth.users
  WHERE email = 'admin@example.com';

  -- Get demo entity id
  SELECT id INTO demo_entity_id
  FROM entities
  WHERE name = 'Sociedad Demo S.L.';

  -- Get demo category id
  SELECT id INTO demo_category_id
  FROM categories
  WHERE name = 'Documentos de Demostración';

  -- Check if demo document exists
  SELECT id INTO demo_doc_id
  FROM documents
  WHERE file_name = 'documento_ejemplo.pdf'
  AND entity_id = demo_entity_id;

  -- Create document if it doesn't exist
  IF demo_doc_id IS NULL AND demo_entity_id IS NOT NULL AND demo_category_id IS NOT NULL THEN
    INSERT INTO documents (
      id,
      entity_id,
      category_id,
      file_name,
      file_path,
      file_size,
      mime_type,
      title,
      description,
      status,
      uploaded_by,
      created_at,
      updated_at,
      content_text
    ) VALUES (
      gen_random_uuid(),
      demo_entity_id,
      demo_category_id,
      'documento_ejemplo.pdf',
      'demo/documento_ejemplo.pdf',
      1024,
      'application/pdf',
      'Documento de Ejemplo',
      'Este es un documento de demostración del sistema de gestión documental. Muestra cómo se estructuran y organizan los documentos en el sistema.',
      'active',
      demo_user_id,
      now(),
      now(),
      'DOCUMENTO DE EJEMPLO

Este es un documento de demostración creado automáticamente por el sistema de seeds.

Propósito:
- Demostrar la estructura de documentos
- Facilitar testing y desarrollo
- Mostrar funcionalidades del sistema

Características:
- Asociado a la entidad "Sociedad Demo S.L."
- Categoría: Documentos de Demostración
- Estado: Activo
- Creado por: Demo Admin

Para uso en desarrollo y pruebas.'
    );

    RAISE NOTICE 'Demo document created: documento_ejemplo.pdf';
    RAISE NOTICE 'Note: This is metadata only. For full functionality, upload an actual file.';
  ELSE
    RAISE NOTICE 'Demo document already exists or dependencies missing';
  END IF;
END $$;

-- Summary
DO $$
BEGIN
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Demo data seeding completed!';
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Login credentials:';
  RAISE NOTICE '  Email: admin@example.com';
  RAISE NOTICE '  Password: Demo123!Admin';
  RAISE NOTICE '';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '  - 1 Admin user';
  RAISE NOTICE '  - 1 Demo category: "Documentos de Demostración"';
  RAISE NOTICE '  - 1 Demo entity: "Sociedad Demo S.L."';
  RAISE NOTICE '  - 1 Demo document: "documento_ejemplo.pdf"';
  RAISE NOTICE '';
  RAISE NOTICE 'System is ready for testing and development!';
  RAISE NOTICE '=================================================';
END $$;
