---
title: P5 - Orquestación RAG con LlamaIndex (respeta ACL/RLS)
labels: P5, ai, retrieval, llamaindex
milestone: P5
---

## Contexto
Proveer respuestas basadas en documentos con filtros por permisos.

## Alcance
- Pipeline de ingestión (chunking, extracción de texto, ACL).
- Consultas con filtros por usuario.
- Abstracción para diferentes modelos (local/cloud).

## Tareas
- [ ] Implementar pipeline y nodos.
- [ ] Query engine con filtros de ACL.
- [ ] Pruebas de precisión y privacidad.

## Criterios de aceptación
- [ ] Un usuario solo recupera fragmentos permitidos.
