# Estructura del Proyecto

## 📁 Árbol de Directorios

```
gestion-documental/
│
├── 📄 Documentación
│   ├── README.md                          # Documentación técnica principal
│   ├── RESUMEN_EJECUTIVO.md              # Resumen para stakeholders
│   ├── GUIA_USUARIO.md                   # Manual del usuario final
│   ├── CONSULTAS_ADMIN.md                # Consultas SQL útiles
│   ├── INSTRUCCIONES_IMPLEMENTACION.md   # Guía de despliegue
│   └── ESTRUCTURA_PROYECTO.md            # Este archivo
│
├── ⚙️ Configuración
│   ├── .env                              # Variables de entorno (Supabase)
│   ├── .gitignore                        # Archivos ignorados por Git
│   ├── package.json                      # Dependencias y scripts
│   ├── package-lock.json                 # Lock de versiones
│   ├── tsconfig.json                     # Configuración TypeScript
│   ├── tsconfig.app.json                 # Config TS para app
│   ├── tsconfig.node.json                # Config TS para Node
│   ├── vite.config.ts                    # Configuración Vite
│   ├── tailwind.config.js                # Configuración Tailwind CSS
│   ├── postcss.config.js                 # Configuración PostCSS
│   └── eslint.config.js                  # Configuración ESLint
│
├── 📦 Código Fuente (src/)
│   ├── main.tsx                          # Punto de entrada
│   ├── App.tsx                           # Componente raíz
│   ├── index.css                         # Estilos globales
│   ├── vite-env.d.ts                     # Tipos de Vite
│   │
│   ├── 🔧 lib/
│   │   └── supabase.ts                   # Cliente y tipos Supabase
│   │
│   ├── 🎣 hooks/
│   │   └── useAuth.tsx                   # Hook de autenticación
│   │
│   └── 🎨 components/
│       ├── Auth.tsx                      # Pantalla login/registro
│       ├── Dashboard.tsx                 # Vista principal
│       └── UploadModal.tsx               # Modal para subir docs
│
├── 🏗️ Build (dist/) - Generado
│   ├── index.html
│   ├── assets/
│   │   ├── index-[hash].css
│   │   └── index-[hash].js
│   └── [otros activos]
│
└── 📚 node_modules/                      # Dependencias (npm install)
```

## 🗂️ Descripción de Archivos Principales

### Documentación (Raíz)

| Archivo | Propósito | Audiencia |
|---------|-----------|-----------|
| **README.md** | Documentación técnica completa | Desarrolladores |
| **RESUMEN_EJECUTIVO.md** | Overview ejecutivo del proyecto | Gerencia/Stakeholders |
| **GUIA_USUARIO.md** | Manual de usuario con ejemplos | Usuarios finales |
| **CONSULTAS_ADMIN.md** | 50+ consultas SQL predefinidas | Administradores/DBAs |
| **INSTRUCCIONES_IMPLEMENTACION.md** | Pasos de despliegue detallados | DevOps/IT |

### Configuración

| Archivo | Descripción |
|---------|-------------|
| **.env** | URLs y keys de Supabase |
| **package.json** | Dependencias: React, Supabase, Tailwind |
| **tsconfig.json** | Configuración TypeScript strict |
| **vite.config.ts** | Build con Vite + React plugin |
| **tailwind.config.js** | Tema y utilidades CSS |

### Código Fuente

#### 🎯 Componentes Principales

**Auth.tsx** (144 líneas)
- Formulario dual: Login + Registro
- Validación de campos
- Manejo de errores
- Diseño responsive con gradientes

**Dashboard.tsx** (336 líneas)
- Listado de documentos en tabla
- Búsqueda en tiempo real
- Filtros por categoría y estado
- Acciones: Ver, Descargar, Compartir, Eliminar
- Header con info de usuario

**UploadModal.tsx** (153 líneas)
- Modal flotante
- Drag & drop de archivos
- Formulario con validación
- Preview de archivo seleccionado
- Feedback de progreso

#### 🔧 Utilidades

**lib/supabase.ts** (90 líneas)
- Cliente de Supabase configurado
- Definición completa de tipos TypeScript
- Interfaces para todas las tablas

**hooks/useAuth.tsx** (75 líneas)
- Context de autenticación
- Gestión de sesión
- Funciones: signIn, signUp, signOut
- Estado de usuario y perfil

## 🗄️ Estructura de Base de Datos

### Tablas (6 principales)

```
auth.users (Supabase Auth)
    └── user_profiles (Perfiles extendidos)
            ├── id (PK, FK)
            ├── full_name
            ├── department
            ├── role (user|manager|admin)
            └── avatar_url

categories (Categorías jerárquicas)
    ├── id (PK)
    ├── name
    ├── description
    └── parent_id (FK, nullable)

documents (Documentos principales) ★
    ├── id (PK)
    ├── title
    ├── description
    ├── file_name
    ├── file_path
    ├── file_size
    ├── mime_type
    ├── category_id (FK)
    ├── version
    ├── status (draft|published|archived)
    ├── owner_id (FK)
    └── metadata (JSONB)

document_access (Permisos)
    ├── id (PK)
    ├── document_id (FK)
    ├── user_id (FK)
    ├── permission (read|write|admin)
    └── granted_by (FK)

document_versions (Historial)
    ├── id (PK)
    ├── document_id (FK)
    ├── version
    ├── file_path
    ├── changes
    └── created_by (FK)

audit_logs (Auditoría) ★
    ├── id (PK)
    ├── document_id (FK, nullable)
    ├── user_id (FK)
    ├── action (view|download|edit|delete|share|upload)
    ├── details (JSONB)
    └── created_at
```

### Storage

```
Bucket: documents
    └── {user_id}/
        ├── {random_id}.pdf
        ├── {random_id}.docx
        └── ...
```

## 🔄 Flujo de Datos

### 1. Autenticación
```
Usuario → Auth.tsx → useAuth → Supabase Auth
                                    ↓
                              user_profiles
                                    ↓
                              Dashboard.tsx
```

### 2. Subir Documento
```
Usuario → Dashboard.tsx → UploadModal.tsx
                              ↓
                         Supabase Storage
                              ↓
                         documents table
                              ↓
                         audit_logs
```

### 3. Buscar/Filtrar
```
Usuario → Dashboard.tsx (estado local)
              ↓
         Supabase Query (SELECT + WHERE)
              ↓
         Filtrado por:
         - Texto (title, description)
         - Categoría (category_id)
         - Estado (status)
```

### 4. Control de Acceso
```
Usuario → Acción en documento
              ↓
         RLS Policy Check
              ↓
    ¿Es propietario? → SÍ → Permitir
              ↓ NO
    ¿Tiene permiso en document_access? → SÍ → Permitir
              ↓ NO
    ¿Es documento público? → SÍ → Permitir
              ↓ NO
         DENEGAR
```

## 📊 Métricas del Código

### Líneas de Código por Tipo

```
TypeScript/TSX:  ~1,000 líneas
  - Componentes:    ~650 líneas
  - Hooks:          ~75 líneas
  - Lib/Utils:      ~90 líneas
  - Config:         ~185 líneas

SQL (Migrations):  ~500 líneas
  - Tablas:         ~250 líneas
  - Políticas RLS:  ~150 líneas
  - Índices:        ~50 líneas
  - Triggers:       ~50 líneas

Markdown (Docs):   ~3,500 líneas
  - README:         ~300 líneas
  - GUIA_USUARIO:   ~600 líneas
  - CONSULTAS:      ~900 líneas
  - RESUMEN:        ~500 líneas
  - INSTRUCCIONES:  ~700 líneas
  - Otros:          ~500 líneas
```

### Build de Producción

```
HTML:       0.48 KB
CSS:       13.91 KB (3.47 KB gzipped)
JS:       292.47 KB (85.82 KB gzipped)
────────────────────────────────────
Total:    ~90 KB (gzipped)
```

## 🎨 Stack Tecnológico Detallado

### Frontend Framework
- **React 18.3.1** - Biblioteca UI
- **TypeScript 5.5.3** - Tipado estático
- **Vite 5.4.2** - Build tool rápido

### Estilos
- **Tailwind CSS 3.4.1** - Framework CSS utility-first
- **PostCSS 8.4.35** - Procesador CSS
- **Autoprefixer 10.4.18** - Prefijos CSS automáticos

### Backend as a Service
- **Supabase 2.57.4** - BaaS completo
  - PostgreSQL 15
  - Supabase Auth
  - Supabase Storage
  - Row Level Security

### Iconos
- **Lucide React 0.344.0** - 1000+ iconos SVG

### Desarrollo
- **ESLint 9.9.1** - Linter JavaScript/TypeScript
- **TypeScript ESLint 8.3.0** - Reglas ESLint para TS

## 🔒 Características de Seguridad

### Implementadas ✅

1. **Autenticación**
   - Email/Password con Supabase Auth
   - Sesiones persistentes
   - Logout seguro

2. **Autorización**
   - 3 roles: user, manager, admin
   - Row Level Security en TODAS las tablas
   - Políticas por tabla (30+ políticas)

3. **Storage**
   - Bucket privado por defecto
   - Políticas por usuario
   - Archivos organizados por user_id

4. **Auditoría**
   - Log de todas las acciones
   - Registro de IP y timestamp
   - Solo admins pueden ver logs

5. **Validación**
   - Validación de formularios en frontend
   - Constraints en base de datos
   - Sanitización de inputs

## 🚀 Performance

### Optimizaciones Aplicadas

✅ **Búsqueda optimizada** con índices en:
- documents.owner_id
- documents.category_id
- documents.status
- document_access.user_id
- audit_logs.document_id

✅ **Build optimizado**:
- Code splitting automático
- Tree shaking
- Minificación
- Compresión gzip

✅ **Queries eficientes**:
- JOINs selectivos
- Paginación ready (no implementada)
- Índices en campos de búsqueda

✅ **Carga lazy**:
- Componentes cargados bajo demanda
- Imágenes optimizadas (Lucide SVG)

## 📱 Responsive Design

### Breakpoints

```css
Mobile:    < 640px  (sm)
Tablet:    640px+   (sm)
Desktop:   1024px+  (lg)
Wide:      1280px+  (xl)
```

### Componentes Adaptables

- ✅ Auth: Stack vertical en móvil
- ✅ Dashboard: Tabla scrollable horizontal
- ✅ Búsqueda: Full-width en móvil
- ✅ Modal: Centrado con padding

## 🔄 Próximas Iteraciones

### v1.1 (Corto Plazo)
- [ ] Previsualización de PDFs
- [ ] Descarga masiva (ZIP)
- [ ] Compartir con email

### v1.2 (Mediano Plazo)
- [ ] Búsqueda full-text
- [ ] Tags personalizables
- [ ] Notificaciones push

### v2.0 (Largo Plazo)
- [ ] App móvil nativa
- [ ] Integración Office 365
- [ ] Workflows de aprobación

## 📞 Contacto

Para consultas sobre la estructura del proyecto:
- Revisar documentación correspondiente
- Consultar GUIA_USUARIO.md para funcionalidad
- Ver CONSULTAS_ADMIN.md para base de datos
- Leer INSTRUCCIONES_IMPLEMENTACION.md para despliegue

---

**Última Actualización:** Octubre 2025
**Versión del Documento:** 1.0.0
