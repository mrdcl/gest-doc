---
title: P2 - Motor de búsqueda con Typesense (facetado y typos)
labels: P2, search, typesense, backend
milestone: P2
---

## Contexto
Mejorar relevancia y tolerancia a errores en búsquedas.

## Alcance
- Desplegar Typesense (0.5–1 GB RAM).
- Sincronizar documentos (título, descripción, categoría, tags).
- Facetas por categoría/estado/tags.

## Tareas
- [ ] Deploy y colección inicial.
- [ ] Ingest incremental en workers.
- [ ] UI con facetado y sugerencias.

## Criterios de aceptación
- [ ] TTR (time-to-result) < 100ms promedio.
