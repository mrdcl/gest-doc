---
title: P4 - Aprobaciones multi-paso (XState)
labels: P4, workflow, frontend, backend
milestone: P4
---

## Contexto
Formalizar revisiones y aprobaciones antes de publicar.

## Alcance
- State machine con XState.
- Roles, transiciones y notificaciones.
- Historial en `document_versions`/`audit_logs`.

## Tareas
- [ ] Definir estados y eventos.
- [ ] Implementar transiciones seguras.
- [ ] UI de aprobación con cola personal.

## Criterios de aceptación
- [ ] Publicación requiere estados aprobados según configuración.
