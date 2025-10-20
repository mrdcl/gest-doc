---
title: P5 - Índices vectoriales (pgvector) para embeddings
labels: P5, ai, database, pgvector
milestone: P5
---

## Contexto
Habilitar búsqueda semántica y RAG.

## Alcance
- Instalar extensión `pgvector`.
- Tabla `document_chunks` con `embedding vector` y metadatos (doc_id, acl hash, etc.).
- Índices ivfflat/hnsw según tamaño.

## Tareas
- [ ] Migraciones y seeds de ejemplo.
- [ ] Benchmarks básicos (kNN latency).
- [ ] Documentar mantenimiento de índices.

## Criterios de aceptación
- [ ] Consultas kNN < 200ms en tamaño esperado.
