---
title: P0 - Contratos de datos con Zod y type-safe endpoints
labels: P0, dx, quality, typescript
milestone: P0
---

## Contexto
Alinear validaciones entre cliente/servidor con Zod y asegurar type-safety extremo.

## Alcance
- Esquemas Zod para inputs/outputs de endpoints.
- Validación en formularios con `react-hook-form` + resolvers Zod.
- CI: `tsc --noEmit` y verificación de tipos estricta.

## Tareas
- [ ] Agregar dependencias `zod` y resolver RHF si aplica.
- [ ] Definir esquemas (Document, Category, Access, Version, AuditLog).
- [ ] Reutilizar esquemas en front y edge functions.
- [ ] Pipeline de build/lint/typecheck en CI.

## Criterios de aceptación
- [ ] Formularios invalidan correctamente (mensajes claros).
- [ ] Endpoints rechazan input inválido con 400/422.
- [ ] CI exige typecheck sin errores.

## Notas de implementación
Node 18+, Vite/TS. Integrar con RHF si ya se usa.
