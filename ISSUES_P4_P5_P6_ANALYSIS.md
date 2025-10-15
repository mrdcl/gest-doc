# 📋 Análisis de Issues P4, P5 y P6

**Repositorio:** https://github.com/mrdcl/gest-doc
**Fecha Análisis:** 2025-10-15
**Issues Analizados:** 8 issues (2 P4 + 4 P5 + 2 P6)

---

## 📊 RESUMEN EJECUTIVO

| Prioridad | Issues | Puntos | Estado | Complejidad |
|-----------|--------|--------|--------|-------------|
| **P4** | 2 | 8 | 🔴 Open | Media-Alta |
| **P5** | 4 | 14 | 🔴 Open | Alta |
| **P6** | 2 | 8 | 🔴 Open | Alta |
| **TOTAL** | **8** | **30** | **🔴 Open** | **Alta** |

---

## 🎯 ISSUES P4 - COLABORACIÓN Y PROCESOS

### ✅ Issue #17 [P4]: Compartición por enlace (expirable) con nanoid
**Puntos:** 3
**Labels:** collaboration, security, phase:4
**Estado:** 🔴 Open

**Descripción:**
Sistema de enlaces compartibles con firma HMAC, expiración temporal y permisos mínimos.

**Tareas Técnicas:**
1. Crear tabla `shared_links` en BD:
   - `token` (nanoid)
   - `docId` (uuid)
   - `expiration` (timestamptz)
   - `permissions` (jsonb)
   - `created_by` (uuid)
   - `access_count` (integer)

2. Implementar firma HMAC y verificación

3. Endpoint de validación de enlaces

**Acceptance Criteria:**
- ✅ Enlaces inválidos o expirados retornan 403
- ✅ Tokens únicos generados con nanoid
- ✅ Verificación HMAC implementada
- ✅ Permisos granulares aplicados

**Dependencias:**
- nanoid (generación de tokens)
- crypto (HMAC signatures)

**Impacto:**
- Permite compartir documentos sin crear usuarios
- Mejora colaboración externa
- Control temporal de acceso

---

### ✅ Issue #16 [P4]: Workflow de aprobación multi-step con XState
**Puntos:** 5
**Labels:** backend, frontend, process, phase:4
**Estado:** 🔴 Open

**Descripción:**
Máquina de estados explícita para workflow: revisión → aprobación → publicado.

**Tareas Técnicas:**
1. Definir estados y transiciones:
   - `draft` → `in_review`
   - `in_review` → `approved` | `rejected`
   - `approved` → `published`
   - `rejected` → `draft`

2. Persistencia de estados en BD

3. SLA y recordatorios (opcional):
   - Notificaciones automáticas
   - Alertas de vencimiento

**Acceptance Criteria:**
- ✅ Transiciones auditadas (audit log)
- ✅ No estados inválidos posibles
- ✅ Historial completo de cambios de estado
- ✅ Permisos por estado (quién puede aprobar)

**Dependencias:**
- xstate (state machine)
- Sistema de notificaciones existente

**Impacto:**
- Formaliza procesos de aprobación
- Trazabilidad completa
- Previene estados inconsistentes
- Base para compliance y auditoría

---

## 🤖 ISSUES P5 - INTELIGENCIA ARTIFICIAL

### ✅ Issue #18 [P5]: Habilitar pgvector + esquema base
**Puntos:** 3
**Labels:** db, ai, phase:5
**Estado:** 🔴 Open

**Descripción:**
Extender BD para RAG y clasificación con vectores.

**Tareas Técnicas:**
1. Instalar extensión `pgvector`

2. Crear tablas:
```sql
CREATE TABLE document_chunks (
  id uuid PRIMARY KEY,
  document_id uuid REFERENCES documents,
  chunk_index integer,
  content text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE chunk_embeddings (
  id uuid PRIMARY KEY,
  chunk_id uuid REFERENCES document_chunks,
  embedding vector(384), -- nomic-embed-text dimension
  model_version text,
  created_at timestamptz DEFAULT now()
);
```

3. Implementar índices vectoriales:
   - `ivfflat` (rápido, menos preciso)
   - `hnsw` (más preciso, más lento)

**Acceptance Criteria:**
- ✅ Búsqueda por similitud < 200ms con 100k chunks

**Dependencias:**
- pgvector extension
- Ollama (embeddings)

**Impacto:**
- Habilita búsqueda semántica
- Base para RAG (Retrieval-Augmented Generation)
- Clasificación automática de documentos

---

### ✅ Issue #19 [P5]: Despliegue de Ollama on-prem
**Puntos:** 3
**Labels:** ai, infra, phase:5
**Estado:** 🔴 Open

**Descripción:**
Servidor Ollama en red interna (sin egreso a internet).

**Tareas Técnicas:**
1. Ejecutar `ollama serve`

2. Descargar modelos:
   - `llama3.1:8b-instruct` (generación de texto)
   - `nomic-embed-text` (embeddings)

3. Configurar cliente backend y variables

**Acceptance Criteria:**
- ✅ `/api/generate` accesible localmente
- ✅ `/api/embeddings` accesible localmente

**Dependencias:**
- Ollama server
- Red interna con acceso a modelos

**Impacto:**
- IA local sin enviar datos afuera
- Privacidad total de documentos
- No dependencia de APIs externas

---

### ✅ Issue #20 [P5]: Orquestación RAG con LlamaIndex
**Puntos:** 5
**Labels:** ai, backend, phase:5
**Estado:** 🔴 Open

**Descripción:**
Pipeline RAG con conciencia de ACL: ingestión → chunking → embeddings → pgvector → retrieval.

**Tareas Técnicas:**
1. Pipeline de ingestión con filtros ACL:
   - Filtrar por `owner`
   - Filtrar por `document_access`

2. Generar respuestas con citaciones:
   - Incluir `docId`
   - Incluir número de página

**Acceptance Criteria:**
- ✅ Sin exposición de contenido no autorizado

**Dependencias:**
- LlamaIndex
- Ollama (embeddings)
- pgvector
- Sistema de permisos actual

**Impacto:**
- Búsqueda inteligente respetuando permisos
- Respuestas contextuales con fuentes
- Descubrimiento de información relacionada

---

### ✅ Issue #21 [P5]: Resúmenes post-subida con BullMQ
**Puntos:** 3
**Labels:** ai, backend, jobs, phase:5
**Estado:** 🔴 Open

**Descripción:**
Job asíncrono que genera resúmenes y sugiere metadata post-ingestión.

**Tareas Técnicas:**
1. Implementar Redis + BullMQ

2. Worker de resumen con:
   - Reintentos automáticos
   - Dead Letter Queue (DLQ)

**Acceptance Criteria:**
- ✅ Tiempo promedio < 10s por documento
- ✅ Aceleración GPU (opcional)

**Dependencias:**
- Redis
- BullMQ
- Ollama (generación)

**Impacto:**
- Metadata automática
- Mejor categorización
- UX mejorada (sugerencias automáticas)

---

## 🚀 ISSUES P6 - FEATURES AVANZADOS

### ✅ Issue #22 [P6]: Explicación de diffs de versión
**Puntos:** 3
**Labels:** ai, backend, frontend, phase:6
**Estado:** 🔴 Open

**Descripción:**
Calcular diff y generar explicación en lenguaje natural con top-5 cambios por impacto.

**Tareas Técnicas:**
1. Integrar `diff-match-patch`

2. Crear prompt para explicaciones:
   - Identificar cambios clave
   - Evaluar impacto
   - Generar resumen

**Acceptance Criteria:**
- ✅ Reporte estructurado con:
  - Cambios clave
  - Riesgos potenciales

**Dependencias:**
- diff-match-patch (ya instalado)
- Ollama (generación de explicaciones)

**Impacto:**
- Revisión más rápida de versiones
- Identificación automática de riesgos
- Mejor comprensión de cambios

---

### ✅ Issue #23 [P6]: Asistente de 'dossier'
**Puntos:** 5
**Labels:** ai, feature, phase:6
**Estado:** 🔴 Open

**Descripción:**
Asistente para componer dossier y exportar PDF con Gotenberg.

**Tareas Técnicas:**
1. Flujo de selección de documentos

2. Generar narrativa contextual (LLM)

3. Exportar PDF con:
   - Índice
   - Narrativa
   - Documentos anexados
   - Referencias

**Acceptance Criteria:**
- ✅ Documento final con anexos y referencias

**Dependencias:**
- Gotenberg (PDF generation)
- Ollama (narrativa)
- Sistema de documentos actual

**Impacto:**
- Creación rápida de paquetes documentales
- Presentaciones profesionales
- Export listo para entregar

---

## 📈 ANÁLISIS DE COMPLEJIDAD

### P4 - Colaboración (8 puntos):
**Complejidad:** Media-Alta
- Requiere nuevas tablas y lógica de seguridad
- XState puede ser complejo de implementar
- Impacto inmediato en UX

**Recomendación:** ✅ Implementar primero
- Features core del negocio
- No requiere IA
- Base para futuras features

### P5 - IA (14 puntos):
**Complejidad:** Alta
- Requiere infraestructura nueva (Redis, Ollama)
- Modelos LLM y embeddings
- Integración compleja

**Recomendación:** ⚠️ Implementar después de P4
- Requiere setup de infra
- Dependencias entre issues
- Orden recomendado: #18 → #19 → #20 → #21

### P6 - Features Avanzados (8 puntos):
**Complejidad:** Alta
- Depende de P5 completamente
- Features nice-to-have

**Recomendación:** 🔵 Implementar al final
- Requiere P5 completo
- No son críticas para operación

---

## 🎯 ROADMAP RECOMENDADO

### Fase 1 - P4 (2-3 semanas):
```
Semana 1-2: Issue #17 (Enlaces compartibles)
Semana 2-3: Issue #16 (Workflow aprobación)
```

### Fase 2 - P5 Base (3-4 semanas):
```
Semana 1: Issue #18 (pgvector setup)
Semana 2: Issue #19 (Ollama deployment)
Semana 3-4: Issue #20 (RAG pipeline)
Semana 4: Issue #21 (Resúmenes automáticos)
```

### Fase 3 - P6 Avanzado (2-3 semanas):
```
Semana 1-2: Issue #22 (Diff explanations)
Semana 2-3: Issue #23 (Dossier assistant)
```

**Total estimado:** 7-10 semanas

---

## 🔧 STACK TECNOLÓGICO NUEVO

### Librerías NPM:
- `nanoid` - Generación de tokens
- `xstate` - State machines
- `bullmq` - Job queues
- `ioredis` - Redis client
- `llamaindex` - RAG orchestration
- `@llamaindex/ollama` - Ollama integration

### Infraestructura:
- Redis (jobs + cache)
- Ollama server (on-prem)
- Gotenberg (PDF generation)

### PostgreSQL Extensions:
- pgvector (vector similarity search)

---

## ⚠️ RIESGOS Y CONSIDERACIONES

### P4:
- ✅ Seguridad de enlaces compartidos crítica
- ✅ XState puede tener curva de aprendizaje
- ✅ Workflow debe ser configurable

### P5:
- ⚠️ Ollama requiere GPU para performance óptima
- ⚠️ Redis es nueva dependencia de infra
- ⚠️ Embeddings ocupan mucho espacio (100k chunks = ~150MB)
- ⚠️ Privacidad: asegurar que ACL funcione correctamente

### P6:
- ⚠️ Gotenberg requiere Docker
- ⚠️ PDF generation puede ser lento
- ⚠️ Explicaciones LLM pueden ser inconsistentes

---

## 📊 PRIORIZACIÓN SUGERIDA

**Para implementar YA:**
1. ✅ Issue #17 [P4] - Enlaces compartibles (mayor impacto UX)
2. ✅ Issue #16 [P4] - Workflow aprobación (critical business process)

**Para implementar próximamente:**
3. Issue #18 [P5] - pgvector (fundación para IA)
4. Issue #19 [P5] - Ollama (fundación para IA)

**Para implementar después:**
5. Issue #20 [P5] - RAG pipeline
6. Issue #21 [P5] - Resúmenes automáticos
7. Issue #22 [P6] - Diff explanations
8. Issue #23 [P6] - Dossier assistant

---

## ✅ CONCLUSIÓN

Los issues P4, P5 y P6 representan una evolución significativa del sistema:

**P4:** Mejora colaboración y formaliza procesos
**P5:** Habilita capacidades de IA avanzadas
**P6:** Features premium para usuarios power

**Esfuerzo Total:** 30 puntos (7-10 semanas)
**Impacto:** Alto en UX, procesos y capacidades del sistema
**Riesgo:** Medio-Alto (nueva infra y tecnologías)

---

**Análisis generado:** 2025-10-15
**Próximo paso recomendado:** Implementar Issue #17 y #16 (P4)
