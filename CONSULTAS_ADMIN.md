# Consultas SQL para Administradores

Este documento contiene consultas SQL útiles para administradores del sistema de gestión documental.

## 📊 Estadísticas Generales

### Total de Documentos por Estado
```sql
SELECT
  status,
  COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as porcentaje
FROM documents
GROUP BY status
ORDER BY total DESC;
```

### Documentos por Categoría
```sql
SELECT
  c.name as categoria,
  COUNT(d.id) as total_documentos,
  ROUND(SUM(d.file_size) / 1024.0 / 1024.0, 2) as tamaño_mb
FROM categories c
LEFT JOIN documents d ON d.category_id = c.id
GROUP BY c.id, c.name
ORDER BY total_documentos DESC;
```

### Usuarios Más Activos
```sql
SELECT
  up.full_name,
  up.department,
  COUNT(d.id) as documentos_subidos,
  ROUND(SUM(d.file_size) / 1024.0 / 1024.0, 2) as tamaño_total_mb
FROM user_profiles up
LEFT JOIN documents d ON d.owner_id = up.id
GROUP BY up.id, up.full_name, up.department
ORDER BY documentos_subidos DESC
LIMIT 10;
```

### Espacio de Almacenamiento por Usuario
```sql
SELECT
  up.full_name,
  COUNT(d.id) as total_archivos,
  ROUND(SUM(d.file_size) / 1024.0 / 1024.0, 2) as mb_usados,
  ROUND(SUM(d.file_size) / 1024.0 / 1024.0 / 1024.0, 2) as gb_usados
FROM user_profiles up
LEFT JOIN documents d ON d.owner_id = up.id
GROUP BY up.id, up.full_name
ORDER BY mb_usados DESC;
```

## 📈 Análisis de Actividad

### Documentos Subidos por Mes
```sql
SELECT
  DATE_TRUNC('month', created_at) as mes,
  COUNT(*) as documentos_subidos,
  ROUND(SUM(file_size) / 1024.0 / 1024.0, 2) as mb_subidos
FROM documents
WHERE created_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY mes DESC;
```

### Actividad de Auditoría por Acción
```sql
SELECT
  action,
  COUNT(*) as total,
  COUNT(DISTINCT user_id) as usuarios_unicos
FROM audit_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY action
ORDER BY total DESC;
```

### Documentos Más Vistos (últimos 30 días)
```sql
SELECT
  d.title,
  d.file_name,
  up.full_name as propietario,
  COUNT(al.id) as veces_visto
FROM documents d
JOIN user_profiles up ON up.id = d.owner_id
LEFT JOIN audit_logs al ON al.document_id = d.id AND al.action = 'view'
WHERE al.created_at >= NOW() - INTERVAL '30 days'
GROUP BY d.id, d.title, d.file_name, up.full_name
ORDER BY veces_visto DESC
LIMIT 20;
```

### Documentos Más Descargados (últimos 30 días)
```sql
SELECT
  d.title,
  d.file_name,
  COUNT(al.id) as descargas
FROM documents d
LEFT JOIN audit_logs al ON al.document_id = d.id AND al.action = 'download'
WHERE al.created_at >= NOW() - INTERVAL '30 days'
GROUP BY d.id, d.title, d.file_name
ORDER BY descargas DESC
LIMIT 20;
```

## 👥 Gestión de Usuarios

### Lista de Usuarios con Roles
```sql
SELECT
  up.full_name,
  up.department,
  up.role,
  u.email,
  up.created_at as fecha_registro,
  COUNT(d.id) as documentos
FROM user_profiles up
JOIN auth.users u ON u.id = up.id
LEFT JOIN documents d ON d.owner_id = up.id
GROUP BY up.id, up.full_name, up.department, up.role, u.email, up.created_at
ORDER BY up.created_at DESC;
```

### Usuarios Sin Actividad Reciente
```sql
SELECT
  up.full_name,
  up.department,
  u.email,
  up.created_at as fecha_registro,
  MAX(al.created_at) as ultima_actividad
FROM user_profiles up
JOIN auth.users u ON u.id = up.id
LEFT JOIN audit_logs al ON al.user_id = up.id
GROUP BY up.id, up.full_name, up.department, u.email, up.created_at
HAVING MAX(al.created_at) < NOW() - INTERVAL '30 days' OR MAX(al.created_at) IS NULL
ORDER BY ultima_actividad NULLS FIRST;
```

### Promover Usuario a Manager
```sql
UPDATE user_profiles
SET role = 'manager'
WHERE id = 'USER_UUID_AQUI';
```

### Promover Usuario a Admin
```sql
UPDATE user_profiles
SET role = 'admin'
WHERE id = 'USER_UUID_AQUI';
```

## 🔍 Auditoría y Seguridad

### Acciones Realizadas por Usuario
```sql
SELECT
  up.full_name,
  al.action,
  COUNT(*) as veces,
  MAX(al.created_at) as ultima_vez
FROM audit_logs al
JOIN user_profiles up ON up.id = al.user_id
WHERE al.created_at >= NOW() - INTERVAL '7 days'
GROUP BY up.full_name, al.action
ORDER BY up.full_name, veces DESC;
```

### Documentos Eliminados Recientemente
```sql
SELECT
  up.full_name as eliminado_por,
  al.details->>'file_name' as archivo,
  al.created_at as fecha_eliminacion
FROM audit_logs al
JOIN user_profiles up ON up.id = al.user_id
WHERE al.action = 'delete'
AND al.created_at >= NOW() - INTERVAL '30 days'
ORDER BY al.created_at DESC;
```

### Documentos Compartidos
```sql
SELECT
  d.title,
  d.file_name,
  owner.full_name as propietario,
  shared.full_name as compartido_con,
  da.permission as permiso,
  da.granted_at as fecha_compartido
FROM document_access da
JOIN documents d ON d.id = da.document_id
JOIN user_profiles owner ON owner.id = d.owner_id
JOIN user_profiles shared ON shared.id = da.user_id
ORDER BY da.granted_at DESC;
```

### Log Completo de Auditoría (últimos 100 eventos)
```sql
SELECT
  up.full_name as usuario,
  al.action as accion,
  d.title as documento,
  al.details,
  al.created_at as fecha
FROM audit_logs al
JOIN user_profiles up ON up.id = al.user_id
LEFT JOIN documents d ON d.id = al.document_id
ORDER BY al.created_at DESC
LIMIT 100;
```

## 📁 Mantenimiento de Documentos

### Documentos Sin Categoría
```sql
SELECT
  d.title,
  d.file_name,
  up.full_name as propietario,
  d.created_at
FROM documents d
JOIN user_profiles up ON up.id = d.owner_id
WHERE d.category_id IS NULL
ORDER BY d.created_at DESC;
```

### Documentos Muy Grandes (> 10 MB)
```sql
SELECT
  d.title,
  d.file_name,
  ROUND(d.file_size / 1024.0 / 1024.0, 2) as tamaño_mb,
  up.full_name as propietario
FROM documents d
JOIN user_profiles up ON up.id = d.owner_id
WHERE d.file_size > 10 * 1024 * 1024
ORDER BY d.file_size DESC;
```

### Documentos Huérfanos (propietario eliminado)
```sql
SELECT
  d.id,
  d.title,
  d.file_name,
  d.created_at
FROM documents d
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u WHERE u.id = d.owner_id
);
```

### Actualizar Categoría de Múltiples Documentos
```sql
UPDATE documents
SET category_id = 'NUEVA_CATEGORIA_UUID'
WHERE owner_id = 'USER_UUID'
AND category_id IS NULL;
```

### Archivar Documentos Antiguos
```sql
UPDATE documents
SET status = 'archived'
WHERE status = 'published'
AND created_at < NOW() - INTERVAL '2 years'
AND updated_at < NOW() - INTERVAL '1 year';
```

## 🗑️ Limpieza de Datos

### Eliminar Logs de Auditoría Antiguos (> 1 año)
```sql
DELETE FROM audit_logs
WHERE created_at < NOW() - INTERVAL '1 year';
```

### Listar Archivos en Storage Sin Referencia en BD
Esta consulta requiere comparar con los archivos reales en storage.
```sql
-- Primero obtener lista de file_paths en BD
SELECT DISTINCT file_path FROM documents
UNION
SELECT DISTINCT file_path FROM document_versions;
```

## 📊 Reportes Personalizados

### Reporte Mensual de Actividad
```sql
SELECT
  TO_CHAR(DATE_TRUNC('month', al.created_at), 'YYYY-MM') as mes,
  COUNT(DISTINCT al.user_id) as usuarios_activos,
  COUNT(CASE WHEN al.action = 'upload' THEN 1 END) as documentos_subidos,
  COUNT(CASE WHEN al.action = 'view' THEN 1 END) as visualizaciones,
  COUNT(CASE WHEN al.action = 'download' THEN 1 END) as descargas
FROM audit_logs al
WHERE al.created_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', al.created_at)
ORDER BY mes DESC;
```

### Documentos por Tipo MIME
```sql
SELECT
  mime_type,
  COUNT(*) as cantidad,
  ROUND(SUM(file_size) / 1024.0 / 1024.0, 2) as tamaño_total_mb
FROM documents
GROUP BY mime_type
ORDER BY cantidad DESC;
```

### Resumen Ejecutivo del Sistema
```sql
SELECT
  (SELECT COUNT(*) FROM user_profiles) as total_usuarios,
  (SELECT COUNT(*) FROM documents) as total_documentos,
  (SELECT COUNT(*) FROM categories) as total_categorias,
  (SELECT COUNT(*) FROM documents WHERE status = 'published') as documentos_publicados,
  (SELECT COUNT(*) FROM documents WHERE status = 'draft') as documentos_borrador,
  (SELECT ROUND(SUM(file_size) / 1024.0 / 1024.0 / 1024.0, 2) FROM documents) as gb_usados,
  (SELECT COUNT(*) FROM audit_logs WHERE created_at >= NOW() - INTERVAL '7 days') as acciones_ultima_semana;
```

## 🔧 Mantenimiento de Categorías

### Ver Jerarquía de Categorías
```sql
WITH RECURSIVE category_tree AS (
  SELECT
    id,
    name,
    parent_id,
    name as path,
    0 as level
  FROM categories
  WHERE parent_id IS NULL

  UNION ALL

  SELECT
    c.id,
    c.name,
    c.parent_id,
    ct.path || ' > ' || c.name,
    ct.level + 1
  FROM categories c
  INNER JOIN category_tree ct ON c.parent_id = ct.id
)
SELECT
  REPEAT('  ', level) || name as categoria_jerarquica,
  (SELECT COUNT(*) FROM documents WHERE category_id = id) as documentos
FROM category_tree
ORDER BY path;
```

### Agregar Nueva Categoría
```sql
INSERT INTO categories (name, description, parent_id)
VALUES ('Nueva Categoría', 'Descripción de la categoría', NULL);
```

## 💾 Respaldo y Recuperación

### Exportar Lista de Documentos (para respaldo)
```sql
SELECT
  d.id,
  d.title,
  d.file_name,
  d.file_path,
  d.file_size,
  d.mime_type,
  c.name as categoria,
  d.status,
  up.full_name as propietario,
  up.email as email_propietario,
  d.created_at,
  d.updated_at
FROM documents d
LEFT JOIN categories c ON c.id = d.category_id
JOIN user_profiles up ON up.id = d.owner_id
JOIN auth.users u ON u.id = up.id
ORDER BY d.created_at DESC;
```

---

## ⚠️ Notas Importantes

1. **Siempre haz respaldo** antes de ejecutar consultas que modifiquen datos (UPDATE, DELETE)
2. **Prueba primero** con SELECT antes de hacer cambios masivos
3. **Usa transacciones** para cambios importantes:
   ```sql
   BEGIN;
   -- Tus consultas aquí
   -- COMMIT; o ROLLBACK; según el resultado
   ```
4. **Documenta** cualquier cambio manual realizado
5. **Verifica permisos** antes de dar acceso a estas consultas

## 📞 Soporte

Para consultas complejas o cambios críticos, contacta al equipo de desarrollo.
