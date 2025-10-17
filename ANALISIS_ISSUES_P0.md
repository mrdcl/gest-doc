# 🚨 Análisis de Issues P0 - Requisitos Previos

**Fecha:** 2025-10-17
**Repositorio:** https://github.com/mrdcl/gest-doc
**Total Issues P0:** 10 issues
**Estado:** ❌ NINGUNO IMPLEMENTABLE por IA sin infraestructura previa

---

## 📊 RESUMEN EJECUTIVO

| Issue | Título | Implementable por IA | Bloqueador |
|-------|--------|---------------------|------------|
| **#31** | Keycloak OIDC | ❌ NO | Servidor Keycloak requerido |
| **#32** | Cloudflare R2 Storage | ❌ NO | Cuenta Cloudflare R2 requerida |
| **#33** | Storage SDK Refactor | ⚠️ PARCIAL | Requiere #32 |
| **#34** | Data Migration Neon | ❌ NO | Base de datos Neon requerida |
| **#35** | File Migration R2 | ❌ NO | Requiere #32 y #34 |
| **#36** | API Adapter PostgREST | ⚠️ PARCIAL | Requiere #34 |
| **#37** | Auth E2E Wiring | ❌ NO | Requiere #31 y #34 |
| **#38** | Cutover & Rollback | ❌ NO | Requiere todos los anteriores |
| **#39** | Operational Docs | ✅ PARCIAL | Solo documentación |
| **#40** | Plan B Feature Flags | ✅ SI | Puede implementarse |

---

## 🎯 CONTEXTO: MIGRACIÓN DE STACK

Los issues P0 representan una **migración completa de infraestructura**:

### Stack Actual (Implementado):
```
Frontend → Supabase Client → Supabase (Auth + DB + Storage)
```

### Stack Objetivo (Issues P0):
```
Frontend → Keycloak (Auth)
        ↓
    PostgREST → Neon (PostgreSQL)
        ↓
    Cloudflare R2 (Storage)
```

**Razón de la migración:**
- Multi-tenancy más robusto
- Control de costos (Cloudflare R2)
- Mayor escalabilidad
- Separación de concerns

---

## 📋 ANÁLISIS DETALLADO DE CADA ISSUE P0

### ❌ Issue #31: Configure Keycloak (OIDC)

**Objetivo:** Single sign-on provider con claims role y tenant_id.

**Pasos:**
1. Crear Realm y Cliente confidencial
2. Configurar Valid Redirect URIs
3. Agregar protocol mappers (role, tenant_id)
4. Firmar con RS256 y exponer JWKS
5. Verificar claims en token

**Acceptance Criteria:**
- JWTs incluyen role y tenant_id
- Rotación documentada y testeada

**⚠️ BLOQUEADORES PARA IMPLEMENTACIÓN POR IA:**

1. **Servidor Keycloak requerido:**
   ```bash
   # Se necesita instalar y configurar
   docker run -p 8080:8080 \
     -e KEYCLOAK_ADMIN=admin \
     -e KEYCLOAK_ADMIN_PASSWORD=admin \
     quay.io/keycloak/keycloak:latest start-dev
   ```

2. **Acceso a consola de administración:**
   - URL: http://localhost:8080/admin
   - Crear realms manualmente
   - Configurar clientes
   - Configurar protocol mappers

3. **Configuración de JWT:**
   - RS256 keys
   - JWKS endpoint
   - Token customization

**DATOS/PASOS PREVIOS REQUERIDOS:**

✅ **Por el usuario/DevOps:**
- [ ] Instalar servidor Keycloak (Docker/VM/Cloud)
- [ ] Crear cuenta administrativa
- [ ] Definir estructura de realms (1 por cliente?)
- [ ] Configurar dominio/URL pública
- [ ] Certificados SSL si es producción

✅ **Información a proporcionar:**
- Lista de clientes (empresas) que usarán el sistema
- Estructura de roles (admin, user, viewer, etc.)
- Política de rotación de keys
- Configuración de redirect URIs (URLs del frontend)

**LO QUE SÍ PUEDO HACER:**
- ✅ Documentar la configuración requerida
- ✅ Crear scripts de configuración
- ✅ Preparar código frontend para OIDC
- ✅ Documentar protocol mappers necesarios

---

### ❌ Issue #32: Adopt Cloudflare R2 Storage

**Objetivo:** Usar R2 como único object storage con presigned URLs.

**Pasos:**
1. Crear bucket R2 y access keys
2. Almacenar credenciales (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)
3. Configurar endpoint: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
4. Implementar presigned PUT/GET URLs con expiración
5. Configurar lifecycle policies

**Acceptance Criteria:**
- Todos los uploads/downloads usan presigned URL
- Sin ACLs públicos

**⚠️ BLOQUEADORES PARA IMPLEMENTACIÓN POR IA:**

1. **Cuenta Cloudflare requerida:**
   ```bash
   # No puedo crear cuentas en servicios externos
   # Requiere: https://dash.cloudflare.com
   ```

2. **Credenciales de acceso:**
   - Account ID
   - Access Key ID
   - Secret Access Key
   - Nombre del bucket

3. **Configuración de bucket:**
   - Región
   - CORS policies
   - Lifecycle rules

**DATOS/PASOS PREVIOS REQUERIDOS:**

✅ **Por el usuario/DevOps:**
- [ ] Crear cuenta en Cloudflare
- [ ] Activar R2 Storage
- [ ] Crear bucket para documentos
- [ ] Generar access keys
- [ ] Configurar CORS para frontend
- [ ] Configurar lifecycle policies (opcional)

✅ **Información a proporcionar:**
```bash
R2_ACCOUNT_ID=abc123def456
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=gest-doc-files
R2_ENDPOINT=https://abc123def456.r2.cloudflarestorage.com
```

**LO QUE SÍ PUEDO HACER:**
- ✅ Crear código para generar presigned URLs
- ✅ Implementar S3-compatible client (AWS SDK)
- ✅ Crear abstracción StorageProvider
- ✅ Documentar configuración de CORS
- ✅ Crear funciones de upload/download

---

### ⚠️ Issue #33: Storage SDK Refactor

**Objetivo:** Refactor storage layer a interface con implementación R2.

**Pasos:**
1. Definir StorageProvider interface (putObject, getPresignedGet/Put, delete, head)
2. Implementar R2StorageProvider usando AWS S3 SDK
3. Mantener SupabaseStorageProvider como backup
4. Feature flag: STORAGE_PROVIDER=r2|supabase

**Acceptance Criteria:**
- Todas las rutas usan la interface
- Swap de provider no afecta UI

**⚠️ BLOQUEADORES PARA IMPLEMENTACIÓN POR IA:**

1. **Depende de Issue #32:**
   - Necesito credenciales R2 para testear
   - No puedo verificar que funciona sin bucket real

**DATOS/PASOS PREVIOS REQUERIDOS:**

✅ **Por el usuario/DevOps:**
- [ ] Completar Issue #32 (bucket R2 configurado)
- [ ] Proporcionar credenciales de testing

**LO QUE SÍ PUEDO HACER:**
- ✅ Crear interface TypeScript StorageProvider
- ✅ Implementar R2StorageProvider (sin testear contra R2 real)
- ✅ Mantener SupabaseStorageProvider existente
- ✅ Crear feature flag STORAGE_PROVIDER
- ✅ Refactor código para usar interface

**CÓDIGO QUE PUEDO GENERAR:**

```typescript
// lib/storage/StorageProvider.ts
export interface StorageProvider {
  putObject(key: string, file: File): Promise<string>;
  getPresignedGetUrl(key: string, expiresIn: number): Promise<string>;
  getPresignedPutUrl(key: string, expiresIn: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
  headObject(key: string): Promise<{ size: number; etag: string }>;
}

// lib/storage/R2StorageProvider.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class R2StorageProvider implements StorageProvider {
  private client: S3Client;

  constructor() {
    this.client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  // ... implementación completa
}
```

---

### ❌ Issue #34: Data Migration Supabase → Neon

**Objetivo:** Mover schema y datos de Supabase a Neon con RLS.

**Pasos:**
1. Congelar schema y generar SQL migrations para Neon
2. Exportar datos con pg_dump
3. Restaurar con pg_restore a Neon
4. Re-aplicar RLS/policies
5. Rebuild FTS/pgvector indexes
6. Validar row counts y checksums

**Acceptance Criteria:**
- Conteo de tablas igual
- Queries clave retornan resultados idénticos

**⚠️ BLOQUEADORES PARA IMPLEMENTACIÓN POR IA:**

1. **Base de datos Neon requerida:**
   ```bash
   # No puedo crear ni acceder a bases de datos Neon
   # Requiere: https://console.neon.tech
   ```

2. **Acceso a Supabase actual:**
   - Necesito connection string de Supabase
   - Permisos para pg_dump
   - Acceso a datos de producción

3. **Acceso a Neon destino:**
   - Connection string de Neon
   - Permisos para pg_restore
   - Credenciales de admin

**DATOS/PASOS PREVIOS REQUERIDOS:**

✅ **Por el usuario/DevOps:**
- [ ] Crear cuenta en Neon.tech
- [ ] Crear proyecto y base de datos
- [ ] Obtener connection string
- [ ] Verificar límites de plan (storage, compute)
- [ ] Configurar backups automáticos
- [ ] Configurar pooling de conexiones

✅ **Información a proporcionar:**
```bash
# Supabase actual
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres

# Neon destino
NEON_DB_URL=postgresql://[USER]:[PASSWORD]@[ENDPOINT].neon.tech/neondb
```

**LO QUE SÍ PUEDO HACER:**
- ✅ Documentar proceso de migración paso a paso
- ✅ Crear script de exportación (pg_dump commands)
- ✅ Crear script de importación (pg_restore commands)
- ✅ Generar SQL para re-aplicar RLS
- ✅ Crear queries de validación (row counts, checksums)
- ✅ Documentar rebuild de índices

**SCRIPTS QUE PUEDO GENERAR:**

```bash
#!/bin/bash
# migration-script.sh

# 1. Export from Supabase
pg_dump $SUPABASE_DB_URL \
  --schema=public \
  --data-only \
  --format=custom \
  --file=dump.backup

# 2. Restore to Neon
pg_restore --dbname=$NEON_DB_URL \
  --verbose \
  --clean \
  --if-exists \
  dump.backup

# 3. Validate
psql $NEON_DB_URL -c "
  SELECT table_name,
         (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
  FROM information_schema.tables t
  WHERE table_schema = 'public'
  ORDER BY table_name;
"
```

---

### ❌ Issue #35: File Migration Supabase Storage → R2

**Objetivo:** Migrar objetos a R2 con verificación de hash.

**Pasos:**
1. Exportar objetos y calcular MD5/SHA256
2. Upload multipart a R2 preservando keys
3. Verificar size/hash
4. Generar reporte de retry
5. Actualizar referencias en DB

**Acceptance Criteria:**
- 100% archivos verificados
- Cero fallos o lista explícita de retry

**⚠️ BLOQUEADORES PARA IMPLEMENTACIÓN POR IA:**

1. **Requiere Issue #32 completado:**
   - Bucket R2 debe existir
   - Credenciales configuradas

2. **Requiere Issue #34 completado:**
   - Base de datos Neon con referencias
   - Actualización de paths

3. **Acceso a Supabase Storage actual:**
   - API keys con permisos de lectura
   - Acceso al bucket actual

**DATOS/PASOS PREVIOS REQUERIDOS:**

✅ **Por el usuario/DevOps:**
- [ ] Completar Issues #32 y #34
- [ ] Inventario de archivos actuales en Supabase Storage
- [ ] Estimar tamaño total y tiempo de migración
- [ ] Plan de ventana de mantenimiento
- [ ] Estrategia de rollback

✅ **Información a proporcionar:**
```bash
# Supabase Storage
SUPABASE_STORAGE_URL=https://[PROJECT].supabase.co/storage/v1
SUPABASE_SERVICE_KEY=[key]

# R2 destino (de Issue #32)
R2_BUCKET_NAME=gest-doc-files
R2_ENDPOINT=https://[ACCOUNT_ID].r2.cloudflarestorage.com
```

**LO QUE SÍ PUEDO HACER:**
- ✅ Crear script de migración en Node.js/Python
- ✅ Implementar verificación de hash (MD5, SHA256)
- ✅ Crear lógica de multipart upload
- ✅ Generar CSV con progreso de migración
- ✅ Script para actualizar DB references
- ✅ Generar reporte de archivos fallidos

**SCRIPT QUE PUEDO GENERAR:**

```typescript
// migrate-files.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream, createHash } from 'fs';

async function migrateFile(
  supabasePath: string,
  r2Key: string
): Promise<{ success: boolean; hash: string }> {
  // 1. Download from Supabase
  const fileBuffer = await downloadFromSupabase(supabasePath);

  // 2. Calculate hash
  const hash = createHash('sha256').update(fileBuffer).digest('hex');

  // 3. Upload to R2
  await uploadToR2(r2Key, fileBuffer);

  // 4. Verify
  const r2Hash = await getR2ObjectHash(r2Key);

  return {
    success: hash === r2Hash,
    hash
  };
}
```

---

### ⚠️ Issue #36: API Adapter PostgREST

**Objetivo:** Encapsular acceso a datos via PostgREST client.

**Pasos:**
1. Crear ApiProvider con CRUD tipado por entidad
2. Implementar PostgrestApiProvider con fetch y JWT
3. Feature flag: DB_PROVIDER=neon|supabase

**Acceptance Criteria:**
- CRUD E2E funciona con DB_PROVIDER=neon
- Swap vía flag preserva UI

**⚠️ BLOQUEADORES PARA IMPLEMENTACIÓN POR IA:**

1. **Requiere Issue #34:**
   - Neon DB debe estar operativa
   - PostgREST debe estar configurado

2. **PostgREST server:**
   ```bash
   # Requiere servidor PostgREST apuntando a Neon
   # No puedo configurar ni acceder a PostgREST
   ```

**DATOS/PASOS PREVIOS REQUERIDOS:**

✅ **Por el usuario/DevOps:**
- [ ] Completar Issue #34 (Neon DB)
- [ ] Instalar PostgREST
- [ ] Configurar PostgREST para apuntar a Neon
- [ ] Exponer PostgREST endpoint

✅ **Información a proporcionar:**
```bash
POSTGREST_URL=https://api.yourdomain.com
POSTGREST_ANON_KEY=your-anon-key
```

**LO QUE SÍ PUEDO HACER:**
- ✅ Crear interface ApiProvider
- ✅ Implementar PostgrestApiProvider
- ✅ Mantener SupabaseApiProvider existente
- ✅ Crear feature flag DB_PROVIDER
- ✅ Implementar CRUD tipado

**CÓDIGO QUE PUEDO GENERAR:**

```typescript
// lib/api/ApiProvider.ts
export interface ApiProvider {
  select<T>(table: string, filters?: Record<string, any>): Promise<T[]>;
  insert<T>(table: string, data: T): Promise<T>;
  update<T>(table: string, id: string, data: Partial<T>): Promise<T>;
  delete(table: string, id: string): Promise<void>;
}

// lib/api/PostgrestApiProvider.ts
export class PostgrestApiProvider implements ApiProvider {
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private getJWT: () => string | null
  ) {}

  async select<T>(table: string, filters?: Record<string, any>): Promise<T[]> {
    const jwt = this.getJWT();
    const headers = {
      'apikey': this.apiKey,
      'Authorization': jwt ? `Bearer ${jwt}` : '',
    };

    const url = new URL(`${this.baseUrl}/${table}`);
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        url.searchParams.set(key, `eq.${value}`);
      });
    }

    const response = await fetch(url.toString(), { headers });
    return response.json();
  }

  // ... resto de métodos
}
```

---

### ❌ Issue #37: Auth E2E Wiring (Keycloak → PostgREST)

**Objetivo:** Claims de Keycloak impulsan RLS en Neon via PostgREST.

**Pasos:**
1. Frontend obtiene token OIDC y lo envía a BFF/PostgREST
2. PostgREST valida JWT vía JWK y selecciona role
3. RLS policies usan request.jwt.claims
4. Test cross-tenant isolation

**Acceptance Criteria:**
- Aislamiento RLS por tenant_id
- Privilegios mínimos sin JWT

**⚠️ BLOQUEADORES PARA IMPLEMENTACIÓN POR IA:**

1. **Requiere Issue #31:** Keycloak configurado
2. **Requiere Issue #34:** Neon DB operativa
3. **Requiere Issue #36:** PostgREST configurado

**DATOS/PASOS PREVIOS REQUERIDOS:**

✅ **Por el usuario/DevOps:**
- [ ] Completar Issues #31, #34, #36
- [ ] Configurar PostgREST JWT secret
- [ ] Configurar JWKS endpoint en PostgREST
- [ ] Testear validación de JWT

**LO QUE SÍ PUEDO HACER:**
- ✅ Crear código frontend para OIDC flow
- ✅ Implementar envío de JWT a PostgREST
- ✅ Documentar configuración de PostgREST
- ✅ Crear RLS policies que usan jwt.claims
- ✅ Scripts de testing de aislamiento

---

### ❌ Issue #38: Cutover & Rollback

**Objetivo:** Switch a stack Neon+R2 con dual-write y rollback seguro.

**Pasos:**
1. Habilitar dual-write temporal
2. Feature flag: STACK_TARGET=legacy|neon
3. Smoke tests automáticos (CRUD + download)
4. Apagar legacy cuando métricas sean green

**Acceptance Criteria:**
- Cutover sin downtime
- Rollback testeado vía flags

**⚠️ BLOQUEADORES PARA IMPLEMENTACIÓN POR IA:**

1. **Requiere TODOS los issues anteriores:**
   - #31, #32, #33, #34, #35, #36, #37

2. **Monitoreo y métricas:**
   - Sistema de observabilidad
   - Alertas configuradas

**DATOS/PASOS PREVIOS REQUERIDOS:**

✅ **Por el usuario/DevOps:**
- [ ] Completar Issues #31-#37
- [ ] Configurar monitoreo (DataDog/NewRelic/Grafana)
- [ ] Definir métricas de éxito
- [ ] Plan de cutover detallado
- [ ] Plan de rollback

**LO QUE SÍ PUEDO HACER:**
- ✅ Implementar lógica de dual-write
- ✅ Crear feature flags
- ✅ Implementar health checks
- ✅ Crear smoke tests automáticos
- ✅ Documentar proceso de cutover

---

### ✅ Issue #39: Operational Docs

**Objetivo:** Runbook para operaciones y visibilidad de costos.

**Pasos:**
1. Documentar configs clave (Keycloak key rotation, Neon backups, PostgREST)
2. Operaciones R2 (Class A/B, $0 egress, lifecycle, budget alerts)
3. Actualizar README (environment matrix, pricing links)

**Acceptance Criteria:**
- README actualizado
- On-call puede resolver incidentes con docs

**✅ ESTE SÍ PUEDO IMPLEMENTARLO:**

**LO QUE PUEDO HACER:**
- ✅ Crear Runbook completo
- ✅ Documentar configuraciones
- ✅ Crear guías de troubleshooting
- ✅ Documentar costos y optimizaciones
- ✅ Actualizar README
- ✅ Crear matriz de ambientes
- ✅ Enlaces a pricing

---

### ✅ Issue #40: Plan B - Feature Flags

**Objetivo:** Retener Supabase como fallback vía providers y flags.

**Pasos:**
1. Mantener SupabaseApiProvider y SupabaseStorageProvider
2. Environment flags: DB_PROVIDER, STORAGE_PROVIDER
3. Scripts para swap de stacks
4. Verificación E2E post-swap

**Acceptance Criteria:**
- Swap vía flags sin rebuild

**✅ ESTE SÍ PUEDO IMPLEMENTARLO:**

**LO QUE PUEDO HACER:**
- ✅ Mantener providers de Supabase existentes
- ✅ Crear system de feature flags robusto
- ✅ Implementar factory pattern para providers
- ✅ Scripts de swap de configuración
- ✅ Tests E2E para ambos stacks

**CÓDIGO QUE PUEDO GENERAR:**

```typescript
// lib/providers/factory.ts
import { ApiProvider } from './ApiProvider';
import { StorageProvider } from './StorageProvider';
import { SupabaseApiProvider } from './SupabaseApiProvider';
import { PostgrestApiProvider } from './PostgrestApiProvider';
import { SupabaseStorageProvider } from './SupabaseStorageProvider';
import { R2StorageProvider } from './R2StorageProvider';

export function createApiProvider(): ApiProvider {
  const provider = import.meta.env.VITE_DB_PROVIDER || 'supabase';

  switch (provider) {
    case 'neon':
      return new PostgrestApiProvider(
        import.meta.env.VITE_POSTGREST_URL!,
        import.meta.env.VITE_POSTGREST_ANON_KEY!,
        () => localStorage.getItem('jwt')
      );
    case 'supabase':
    default:
      return new SupabaseApiProvider();
  }
}

export function createStorageProvider(): StorageProvider {
  const provider = import.meta.env.VITE_STORAGE_PROVIDER || 'supabase';

  switch (provider) {
    case 'r2':
      return new R2StorageProvider();
    case 'supabase':
    default:
      return new SupabaseStorageProvider();
  }
}
```

---

## 🎯 RESUMEN: QUÉ PUEDE HACER LA IA vs QUÉ REQUIERE USUARIO

### ❌ NO PUEDO IMPLEMENTAR (Requiere Infraestructura):
1. **Issue #31** - Keycloak: Requiere servidor Keycloak
2. **Issue #32** - R2 Storage: Requiere cuenta Cloudflare
3. **Issue #34** - Neon Migration: Requiere BD Neon
4. **Issue #35** - File Migration: Requiere #32 + #34
5. **Issue #37** - Auth E2E: Requiere #31 + #34 + #36
6. **Issue #38** - Cutover: Requiere todos los anteriores

### ⚠️ PUEDO IMPLEMENTAR PARCIALMENTE (Código sin testing real):
7. **Issue #33** - Storage SDK: Puedo crear código, no testearlo
8. **Issue #36** - API Adapter: Puedo crear código, no testearlo

### ✅ PUEDO IMPLEMENTAR COMPLETAMENTE:
9. **Issue #39** - Docs: Documentación completa
10. **Issue #40** - Feature Flags: Sistema de feature flags completo

---

## 📋 CHECKLIST PARA EL USUARIO

### Fase 1: Infraestructura Base (Usuario/DevOps)
```bash
[ ] 1. Crear cuenta Cloudflare y habilitar R2
    - Crear bucket
    - Generar access keys
    - Configurar CORS

[ ] 2. Crear cuenta Neon.tech
    - Crear proyecto
    - Obtener connection string
    - Configurar backups

[ ] 3. Instalar/configurar Keycloak
    - Docker: docker-compose up keycloak
    - O usar Keycloak Cloud
    - Obtener OIDC endpoints

[ ] 4. Configurar PostgREST
    - Instalar PostgREST
    - Apuntar a Neon DB
    - Configurar JWT validation
```

### Fase 2: Credenciales y Configuración (Usuario)
```bash
[ ] Proporcionar credenciales:
    R2_ACCOUNT_ID=...
    R2_ACCESS_KEY_ID=...
    R2_SECRET_ACCESS_KEY=...
    R2_BUCKET_NAME=...

    NEON_DB_URL=...

    KEYCLOAK_URL=...
    KEYCLOAK_REALM=...
    KEYCLOAK_CLIENT_ID=...

    POSTGREST_URL=...
    POSTGREST_ANON_KEY=...
```

### Fase 3: IA Puede Implementar Código
```bash
[ ] Código que la IA generará:
    - StorageProvider interface + R2 impl
    - ApiProvider interface + PostgREST impl
    - Feature flags system
    - OIDC flow frontend
    - Migration scripts
    - Smoke tests
    - Documentación operacional
```

---

## 🚀 ORDEN RECOMENDADO DE IMPLEMENTACIÓN

```
USUARIO HACE:
1. Issue #32 → Setup Cloudflare R2
2. Issue #34 → Setup Neon DB
3. Issue #31 → Setup Keycloak

IA PUEDE HACER (en paralelo):
4. Issue #40 → Feature Flags System
5. Issue #39 → Documentation

USUARIO + IA:
6. Issue #33 → Storage SDK (IA código, Usuario testing)
7. Issue #36 → API Adapter (IA código, Usuario testing)

USUARIO CONFIGURA:
8. Issue #37 → Auth E2E Wiring

USUARIO + IA:
9. Issue #35 → File Migration (IA script, Usuario ejecuta)

USUARIO HACE:
10. Issue #38 → Cutover & Rollback
```

---

## 💡 RECOMENDACIÓN FINAL

**Los issues P0 NO son implementables por IA sin infraestructura previa.**

Representan una migración completa de stack que requiere:
- Cuentas en servicios externos (Cloudflare, Neon, Keycloak)
- Configuración de servidores
- Acceso a bases de datos reales
- Testing con infraestructura real

**Lo que SÍ puedo hacer:**
1. ✅ Generar TODO el código necesario
2. ✅ Crear scripts de migración
3. ✅ Documentar cada paso
4. ✅ Implementar feature flags para rollback
5. ✅ Crear tests automáticos

**Lo que el USUARIO debe hacer primero:**
1. ❌ Provisionar infraestructura (R2, Neon, Keycloak)
2. ❌ Proporcionar credenciales
3. ❌ Ejecutar scripts de migración
4. ❌ Validar en ambiente real

---

**Conclusión:** Los issues P0 están bloqueados por requisitos de infraestructura externa. Puedo preparar todo el código y documentación, pero la implementación real requiere que el usuario configure primero los servicios de terceros.

**Próximo paso recomendado:** Implementar Issue #40 (Feature Flags) para preparar el camino, y Issue #39 (Docs) para guiar al usuario en la configuración de infraestructura.
