# Instrucciones de Implementación

## 🎯 Objetivo

Este documento proporciona pasos específicos para implementar el Sistema de Gestión Documental en tu organización.

## ✅ Estado Actual

El sistema está **100% funcional** y listo para uso. Todo lo necesario ya está configurado:

- ✅ Base de datos creada con todas las tablas
- ✅ Políticas de seguridad (RLS) activas
- ✅ Bucket de storage configurado
- ✅ Frontend compilado y optimizado
- ✅ Autenticación funcionando
- ✅ Documentación completa

## 🚀 Despliegue Rápido (5 minutos)

### Opción A: Despliegue en Vercel (Recomendado)

1. **Crear cuenta en Vercel** (si no tienes)
   - Visita: https://vercel.com
   - Regístrate con GitHub/GitLab/Bitbucket

2. **Conectar repositorio**
   - Sube este proyecto a tu repositorio Git
   - En Vercel: "New Project" → Importa tu repositorio

3. **Configurar variables de entorno**
   ```
   VITE_SUPABASE_URL=https://mrbcjqcbeabgurkmsupx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yYmNqcWNiZWFiZ3Vya21zdXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNzU2NTAsImV4cCI6MjA3NTk1MTY1MH0.zgGDUZgWIfXu5Z8Opz_Gnp5FbVLyQT7_UemZqcYdezQ
   ```

4. **Deploy**
   - Click en "Deploy"
   - Espera 2-3 minutos
   - ¡Listo! Tu app estará en: `https://tu-proyecto.vercel.app`

### Opción B: Despliegue en Netlify

1. **Crear cuenta en Netlify**
   - Visita: https://netlify.com

2. **Deploy manual**
   ```bash
   npm run build
   ```
   - En Netlify: "Sites" → "Add new site" → "Deploy manually"
   - Arrastra la carpeta `dist/` a Netlify

3. **Configurar variables de entorno**
   - En Site Settings → Environment Variables
   - Agrega las mismas variables que en .env

### Opción C: Servidor Propio (VPS/Hosting)

1. **Build del proyecto**
   ```bash
   npm install
   npm run build
   ```

2. **Subir carpeta dist/**
   - Usa FTP/SFTP para subir la carpeta `dist/` a tu servidor
   - Configura tu servidor web (Nginx/Apache) para servir archivos estáticos

3. **Configuración Nginx (ejemplo)**
   ```nginx
   server {
       listen 80;
       server_name tu-dominio.com;
       root /var/www/gestion-documental/dist;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

## 👤 Configuración Inicial de Usuarios

### 1. Crear Usuario Administrador

**Paso 1:** Regístrate desde la aplicación
- Email: admin@tuempresa.com
- Password: [tu_password_seguro]
- Nombre: Administrador del Sistema

**Paso 2:** Actualizar rol a administrador
```sql
-- Ejecutar en Supabase SQL Editor
UPDATE user_profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users
  WHERE email = 'admin@tuempresa.com'
);
```

### 2. Crear Usuarios de Prueba

Repite el proceso anterior para crear:

**Manager:**
```sql
UPDATE user_profiles
SET role = 'manager', department = 'Gerencia'
WHERE id = (
  SELECT id FROM auth.users
  WHERE email = 'manager@tuempresa.com'
);
```

**Usuario Regular:**
- No requiere cambios, el rol por defecto es 'user'

## 📁 Configuración de Categorías Personalizadas

### Agregar Categorías Específicas de tu Empresa

```sql
-- Ejemplo: Agregar categoría específica
INSERT INTO categories (name, description) VALUES
  ('Área Legal', 'Documentos legales y jurídicos'),
  ('Área Técnica', 'Especificaciones y manuales técnicos'),
  ('Marketing', 'Materiales de marketing y publicidad');
```

### Crear Subcategorías

```sql
-- Ejemplo: Subcategoría de "Proyectos"
INSERT INTO categories (name, description, parent_id) VALUES
  ('Proyecto Alpha', 'Documentación del Proyecto Alpha',
   (SELECT id FROM categories WHERE name = 'Proyectos'));
```

## 🔧 Personalización

### 1. Cambiar Colores del Tema

Editar `tailwind.config.js`:
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          // ... tus colores
          600: '#2563eb', // Color principal
          700: '#1d4ed8',
        }
      }
    }
  }
}
```

### 2. Cambiar Logo y Nombre

Editar `src/components/Auth.tsx` y `src/components/Dashboard.tsx`:
```tsx
// Reemplazar:
<h1 className="text-3xl font-bold">Gestión Documental</h1>
// Por:
<h1 className="text-3xl font-bold">Tu Empresa</h1>
```

### 3. Ajustar Límites de Tamaño de Archivo

Editar `src/components/UploadModal.tsx`:
```tsx
// Agregar validación de tamaño
if (file.size > 50 * 1024 * 1024) { // 50 MB
  setError('El archivo es demasiado grande. Máximo 50 MB.');
  return;
}
```

## 📊 Monitoreo y Mantenimiento

### 1. Revisar Logs de Auditoría

```sql
-- Últimas 100 acciones
SELECT
  up.full_name,
  al.action,
  d.title,
  al.created_at
FROM audit_logs al
JOIN user_profiles up ON up.id = al.user_id
LEFT JOIN documents d ON d.id = al.document_id
ORDER BY al.created_at DESC
LIMIT 100;
```

### 2. Monitorear Uso de Storage

```sql
-- Uso por usuario
SELECT
  up.full_name,
  COUNT(d.id) as archivos,
  ROUND(SUM(d.file_size) / 1024.0 / 1024.0, 2) as mb_usados
FROM user_profiles up
LEFT JOIN documents d ON d.owner_id = up.id
GROUP BY up.id, up.full_name
ORDER BY mb_usados DESC;
```

### 3. Limpieza Periódica

```sql
-- Eliminar logs antiguos (ejecutar mensualmente)
DELETE FROM audit_logs
WHERE created_at < NOW() - INTERVAL '6 months';

-- Archivar documentos viejos
UPDATE documents
SET status = 'archived'
WHERE status = 'published'
AND updated_at < NOW() - INTERVAL '2 years';
```

## 🔒 Seguridad Adicional

### 1. Configurar 2FA (Recomendado)

En Supabase Dashboard:
- Authentication → Settings
- Habilitar "Email Confirmations"
- Habilitar "Email Rate Limits"

### 2. Configurar Backup Automático

En Supabase Dashboard:
- Settings → Database
- Habilitar "Daily Backups"
- Retención: 7 días (o más según plan)

### 3. Revisar Políticas RLS

```sql
-- Verificar que RLS esté activo
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = false;

-- Resultado esperado: Ninguna tabla
```

## 📧 Configurar Notificaciones (Opcional)

### 1. Email de Bienvenida

Crear Edge Function en Supabase:
```typescript
// Enviar email cuando usuario se registra
Deno.serve(async (req) => {
  // Lógica de envío de email
});
```

### 2. Notificaciones de Compartir

Similar al anterior, crear función que se active cuando:
- Se comparte un documento
- Se menciona a un usuario
- Se actualiza un documento compartido

## 🎨 Branding Personalizado

### 1. Agregar Logo de Empresa

1. Coloca tu logo en `public/logo.png`
2. Actualiza componentes:

```tsx
// En Auth.tsx y Dashboard.tsx
<img src="/logo.png" alt="Logo" className="w-16 h-16" />
```

### 2. Configurar Favicon

1. Reemplaza `public/vite.svg` con tu favicon
2. Actualiza `index.html`:

```html
<link rel="icon" type="image/svg+xml" href="/tu-favicon.svg" />
```

## 📱 Configuración de PWA (Opcional)

Para convertir en Progressive Web App:

1. Instalar plugin:
```bash
npm install vite-plugin-pwa -D
```

2. Configurar en `vite.config.ts`:
```typescript
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Gestión Documental',
        short_name: 'Docs',
        theme_color: '#2563eb'
      }
    })
  ]
})
```

## 🧪 Testing en Producción

### Checklist de Pruebas

- [ ] Registro de nuevo usuario funciona
- [ ] Login funciona correctamente
- [ ] Subir documento funciona
- [ ] Búsqueda encuentra documentos
- [ ] Filtros funcionan correctamente
- [ ] Eliminar documento funciona
- [ ] Compartir documento funciona (si implementado)
- [ ] Logs de auditoría se registran
- [ ] Storage guarda archivos correctamente
- [ ] Responsive funciona en móvil
- [ ] Performance es aceptable (< 3s carga inicial)

## 🆘 Solución de Problemas Comunes

### Error: "Failed to fetch"
**Causa:** Variables de entorno incorrectas
**Solución:** Verifica que VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY estén correctas

### Error: "Row-level security policy violated"
**Causa:** Usuario sin perfil en user_profiles
**Solución:**
```sql
INSERT INTO user_profiles (id, full_name, role)
SELECT id, email, 'user' FROM auth.users
WHERE id NOT IN (SELECT id FROM user_profiles);
```

### Archivos no se suben
**Causa:** Bucket 'documents' no existe o sin políticas
**Solución:**
```sql
-- Ya está creado, pero verificar:
SELECT * FROM storage.buckets WHERE id = 'documents';
```

### Usuario no puede ver documentos
**Causa:** RLS bloqueando acceso
**Solución:** Verificar que el documento esté en estado 'published' o compartido

## 📞 Contacto de Soporte

### Durante Implementación
- Revisar documentación en README.md
- Ejecutar consultas de diagnóstico en CONSULTAS_ADMIN.md
- Verificar logs de Supabase

### Después de Implementación
- Capacitar a usuarios con GUIA_USUARIO.md
- Monitorear logs de auditoría
- Realizar backups periódicos

## ✅ Checklist Final

Antes de dar acceso a usuarios:

- [ ] Sistema desplegado en URL accesible
- [ ] Usuario administrador creado y configurado
- [ ] Categorías relevantes agregadas
- [ ] Variables de entorno configuradas
- [ ] Storage funcionando correctamente
- [ ] RLS activo en todas las tablas
- [ ] Backup automático configurado
- [ ] Documentación accesible para usuarios
- [ ] Pruebas completas realizadas
- [ ] Branding personalizado (opcional)

## 🎉 ¡Listo!

Tu Sistema de Gestión Documental está **completamente implementado y listo para uso**.

**Próximo paso:** Capacitar a tus usuarios con la GUIA_USUARIO.md

---

**Fecha:** Octubre 2025
**Versión del Sistema:** 1.0.0
