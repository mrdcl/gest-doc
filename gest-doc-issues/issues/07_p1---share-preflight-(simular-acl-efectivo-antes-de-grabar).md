---
title: P1 - Share preflight (simular ACL efectivo antes de grabar)
labels: P1, security, backend, sql
milestone: P1
---

## Contexto
Evitar errores de permisos: verificar acceso efectivo antes de persistir `document_access`.

## Alcance
- Función SQL/edge `check_effective_read_access(doc_id, user_id)`.
- UI utiliza preflight para validar permisos y mostrar alertas previas.

## Tareas
- [ ] Crear función y tests.
- [ ] Integrar en modal de compartir.
- [ ] Mensajes claros en UI ante conflictos.

## Criterios de aceptación
- [ ] Casos conflictivos se detectan y previenen antes de guardar.
