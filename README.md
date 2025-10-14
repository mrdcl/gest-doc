# Sistema de Gestión Documental Corporativa

Plataforma completa de gestión documental con autenticación, control de acceso, categorización, versionado y auditoría.

## 🚀 Características Principales

### Gestión de Documentos
- **Carga de archivos** múltiples formatos (PDF, Word, Excel, imágenes, etc.)
- **Categorización** jerárquica de documentos
- **Búsqueda avanzada** por título, descripción y metadatos
- **Filtros dinámicos** por categoría y estado
- **Control de versiones** con historial completo
- **Estados de documento**: Borrador, Publicado, Archivado

### Seguridad y Control de Acceso
- **Autenticación** con Supabase (email/password)
- **Roles de usuario**: Usuario, Manager, Administrador
- **Row Level Security (RLS)** en todas las tablas
- **Control granular** de permisos por documento
- **Permisos**: Lectura, Escritura, Administración
- **Auditoría completa** de acciones (ver, descargar, editar, eliminar, compartir)

### Almacenamiento
- **Supabase Storage** para archivos
- **Organización** por usuario en carpetas privadas
- **Metadatos** extensibles en formato JSON
- **Optimización** de tamaño y rendimiento

## 📋 Requisitos Previos

- Node.js 18+ y npm
- Cuenta de Supabase (ya configurada)

## 🛠️ Instalación

1. **Instalar dependencias**:
```bash
npm install
```

2. **Configuración de variables de entorno**:
El archivo `.env` ya está configurado con las credenciales de Supabase.

3. **Iniciar servidor de desarrollo**:
```bash
npm run dev
```

4. **Build para producción**:
```bash
npm run build
```

## 📊 Estructura de la Base de Datos

### Tablas Principales

#### `user_profiles`
Perfiles extendidos de usuarios con roles y departamentos.
- `id`: UUID (FK a auth.users)
- `full_name`: Nombre completo
- `department`: Departamento
- `role`: user | manager | admin
- `avatar_url`: URL de avatar

#### `categories`
Categorías jerárquicas para organizar documentos.
- `id`: UUID
- `name`: Nombre de la categoría
- `description`: Descripción
- `parent_id`: Para subcategorías (FK a categories)

#### `documents`
Tabla principal de documentos con metadatos completos.
- `id`: UUID
- `title`: Título del documento
- `description`: Descripción
- `file_name`: Nombre del archivo original
- `file_path`: Ruta en Supabase Storage
- `file_size`: Tamaño en bytes
- `mime_type`: Tipo MIME
- `category_id`: FK a categories
- `version`: Número de versión
- `status`: draft | published | archived
- `owner_id`: FK a auth.users
- `metadata`: JSONB para datos adicionales

#### `document_access`
Control de acceso granular por documento y usuario.
- `id`: UUID
- `document_id`: FK a documents
- `user_id`: FK a auth.users
- `permission`: read | write | admin
- `granted_by`: FK a auth.users
- `granted_at`: Timestamp

#### `document_versions`
Historial completo de versiones de documentos.
- `id`: UUID
- `document_id`: FK a documents
- `version`: Número de versión
- `file_path`: Ruta del archivo
- `changes`: Descripción de cambios
- `created_by`: FK a auth.users

#### `audit_logs`
Registro detallado de todas las acciones.
- `id`: UUID
- `document_id`: FK a documents (nullable)
- `user_id`: FK a auth.users
- `action`: view | download | edit | delete | share | upload
- `details`: JSONB con detalles adicionales
- `created_at`: Timestamp

## 🔐 Seguridad

### Row Level Security (RLS)

Todas las tablas tienen RLS habilitado con políticas restrictivas:

- **user_profiles**: Los usuarios solo pueden ver/editar su propio perfil
- **categories**: Visibles para todos, solo administradores pueden modificar
- **documents**: Los usuarios ven solo sus documentos, documentos públicos o compartidos con ellos
- **document_access**: Solo propietarios y usuarios con permisos admin pueden gestionar accesos
- **document_versions**: Acceso basado en permisos del documento principal
- **audit_logs**: Solo administradores pueden ver logs, todos pueden crear

### Storage Policies

El bucket `documents` tiene políticas que permiten:
- Subir archivos solo en la carpeta del usuario (user_id)
- Ver, actualizar y eliminar solo archivos propios
- Estructura: `{user_id}/{filename}`

## 🎨 Interfaz de Usuario

### Pantallas Principales

1. **Autenticación**
   - Login con email/password
   - Registro de nuevos usuarios
   - Diseño moderno y responsivo

2. **Dashboard**
   - Vista de todos los documentos accesibles
   - Barra de búsqueda en tiempo real
   - Filtros por categoría y estado
   - Tabla con información detallada
   - Acciones: Ver, Descargar, Compartir, Eliminar

3. **Modal de Carga**
   - Drag & drop de archivos
   - Formulario con título, descripción, categoría y estado
   - Validación de campos
   - Feedback visual del progreso

### Componentes Clave

- `AuthProvider`: Context de autenticación
- `Auth`: Pantalla de login/registro
- `Dashboard`: Vista principal con listado de documentos
- `UploadModal`: Modal para subir nuevos documentos

## 📦 Tecnologías Utilizadas

- **Frontend**: React 18 + TypeScript + Vite
- **Estilos**: Tailwind CSS
- **Iconos**: Lucide React
- **Backend**: Supabase
  - PostgreSQL (base de datos)
  - Storage (archivos)
  - Auth (autenticación)
  - Row Level Security (seguridad)

## 🔄 Flujos de Trabajo

### Subir Documento
1. Usuario hace clic en "Subir"
2. Selecciona archivo y completa metadatos
3. Archivo se sube a Storage en carpeta del usuario
4. Registro se crea en tabla `documents`
5. Log de auditoría se genera automáticamente

### Compartir Documento
1. Propietario selecciona documento
2. Agrega usuarios y niveles de permiso
3. Registros se crean en `document_access`
4. Usuarios reciben acceso según permisos

### Control de Versiones
1. Usuario edita documento existente
2. Nueva versión se sube a Storage
3. Registro en `document_versions` con número incremental
4. Documento principal actualiza campo `version`

## 🚦 Scripts Disponibles

```bash
npm run dev        # Servidor de desarrollo
npm run build      # Build de producción
npm run preview    # Vista previa del build
npm run lint       # Linter de código
npm run typecheck  # Verificación de tipos TypeScript
```

## 📝 Categorías Predefinidas

El sistema incluye las siguientes categorías iniciales:
- **Contratos**: Documentos contractuales y acuerdos legales
- **Facturas**: Facturas y documentos contables
- **Recursos Humanos**: Documentos de personal y nómina
- **Proyectos**: Documentación de proyectos
- **Políticas**: Políticas y procedimientos corporativos
- **Reportes**: Reportes y análisis
- **General**: Documentos generales y misceláneos

## 🎯 Próximas Mejoras

- [ ] Previsualización de documentos en el navegador
- [ ] Descarga masiva de documentos
- [ ] Notificaciones por email
- [ ] Búsqueda de texto completo (full-text search)
- [ ] Etiquetas (tags) adicionales
- [ ] Exportación de reportes de auditoría
- [ ] Integración con APIs externas
- [ ] Aplicación móvil

## 📄 Licencia

Sistema desarrollado para uso interno. Prohibido su uso sin autorización expresa.

## 👥 Soporte

Sistema desarrollado para uso interno. Se entrega "as is", sin soporte.
