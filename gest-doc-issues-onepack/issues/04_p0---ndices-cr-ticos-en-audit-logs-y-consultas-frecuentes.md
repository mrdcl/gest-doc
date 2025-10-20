---
title: P0 - Índices críticos en audit_logs y consultas frecuentes
labels: P0, db, indexes, audit
milestone: P0
---

## Contexto
Acelerar auditoría/búsquedas administrativas.

## Alcance
- Índices en (user_id, document_id, action, created_at).
- Revisión de planes de consulta y ajuste.

## Tareas
- [ ] Crear índices y verificar con `EXPLAIN ANALYZE`.
- [ ] Documentar mantenimiento (vacuum, reindex).

## Criterios de aceptación
- [ ] Consultas de auditoría < 200ms en dataset objetivo.
