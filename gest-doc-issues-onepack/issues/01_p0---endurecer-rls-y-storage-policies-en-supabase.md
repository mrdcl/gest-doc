---
title: P0 - Endurecer RLS y Storage policies en Supabase
labels: P0, security, backend, supabase
milestone: P0
---

## Contexto
Fortalecer políticas RLS en tablas (`documents`, `document_access`, `document_versions`, `audit_logs`) y políticas de Storage (bucket privado por usuario).

## Alcance
- Revisar y documentar reglas RLS por rol (user/manager/admin).
- Alinear políticas de Storage con estructura `{user_id}/{filename}`.
- Agregar tests de seguridad (negativos y positivos).

## Tareas
- [ ] Auditoría de políticas existentes.
- [ ] Escribir y migrar RLS que falten.
- [ ] Políticas de Storage para lectura/escritura solo del propietario y quienes tengan permiso.
- [ ] Suite de pruebas (SQL y/o edge functions).
- [ ] Documentación en README/SECURITY.md.

## Criterios de aceptación
- [ ] Accesos no permitidos fallan con 403 (RLS) en queries de ejemplo.
- [ ] Storage impide lectura fuera del ACL efectivo.
- [ ] Tests automatizados pasando en CI.

## Notas de implementación
Librerías/Servicios: Supabase (Auth, Postgres, Storage). Reqs: proyecto Supabase, secrets, migraciones SQL.
