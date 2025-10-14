# Database Migrations

Este directorio contiene todas las migraciones de base de datos del proyecto en orden cronológico.

## 📋 Orden de Migraciones

Las migraciones se ejecutan automáticamente en orden alfabético por nombre de archivo (timestamp):

1. `20251013213545_create_document_management_final.sql` - Sistema base de gestión documental
2. `20251013221800_add_client_hierarchy_structure.sql` - Jerarquía de clientes
3. `20251013223112_add_movement_types_and_subcategories.sql` - Tipos de movimientos
4. `20251013225257_setup_required_documents_by_entity_type_v2.sql` - Documentos requeridos
5. `20251013233335_add_document_content_indexing.sql` - Indexación de contenido
6. `20251014125715_upgrade_audit_trail_system.sql` - Sistema de auditoría
7. `20251014125911_add_two_factor_authentication.sql` - Autenticación 2FA
8. `20251014132058_create_notification_system.sql` - Sistema de notificaciones
9. `20251014132238_create_document_tagging_system.sql` - Sistema de etiquetas
10. `20251014132305_create_recycle_bin_system.sql` - Papelera de reciclaje
11. `20251014133549_create_session_management_v2.sql` - Gestión de sesiones
12. `20251014174202_fix_audit_logs_constraint_properly.sql` - Fix de constraints

## 🔄 Idempotencia

Todas las migraciones están diseñadas para ser idempotentes usando:
- `CREATE TABLE IF NOT EXISTS`
- `DO $$ BEGIN ... IF NOT EXISTS ... END $$` para columnas
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (cuando es soportado)
- Checks antes de crear índices, constraints, etc.

## 🚀 Ejecutar Migraciones

### En desarrollo local:
```bash
npm run db:push
```

### Aplicar seeds de demostración:
```bash
npm run db:seed
```

O usar Supabase CLI directamente:
```bash
supabase db push
supabase db seed
```

## 📊 Estructura de Base de Datos

### Tablas Principales

#### Gestión de Usuarios
- `user_profiles` - Perfiles de usuario
- `user_sessions` - Sesiones activas
- `two_factor_auth` - Configuración 2FA

#### Gestión Documental
- `entities` - Sociedades, personas físicas, etc.
- `categories` - Categorías de documentos
- `subcategories` - Subcategorías
- `documents` - Documentos principales
- `document_versions` - Versiones de documentos
- `document_tags` - Etiquetas
- `document_tag_assignments` - Asignación de etiquetas

#### Sistema de Auditoría
- `audit_logs` - Registro de auditoría

#### Notificaciones
- `notifications` - Notificaciones del sistema
- `notification_preferences` - Preferencias de notificación

#### Papelera
- `recycle_bin` - Elementos eliminados (soft delete)

## 🔐 Row Level Security (RLS)

Todas las tablas tienen RLS habilitado con políticas específicas para:
- `authenticated` - Usuarios autenticados
- Checks de permisos basados en roles
- Validación de propiedad de datos

## 📝 Crear Nueva Migración

1. Crear archivo con timestamp:
```bash
supabase migration new nombre_descriptivo
```

2. Escribir SQL idempotente
3. Incluir comentario descriptivo al inicio
4. Probar localmente
5. Commit al repositorio

## ✅ Verificación

Después de ejecutar migraciones, verificar:

```sql
-- Ver todas las tablas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Ver políticas RLS
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Ver índices
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

## 🐛 Troubleshooting

### Error: "relation already exists"
- La migración no es idempotente
- Usar `IF NOT EXISTS` o bloques `DO $$`

### Error: "permission denied"
- Verificar RLS policies
- Verificar rol del usuario

### Error: "constraint violation"
- Revisar datos existentes
- Actualizar datos antes de agregar constraints

## 📚 Recursos

- [Supabase Migrations Docs](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [PostgreSQL IF NOT EXISTS](https://www.postgresql.org/docs/current/sql-createtable.html)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
