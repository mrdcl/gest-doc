---
title: P4 - Links compartidos con expiración y tokens firmados
labels: P4, collaboration, security, links
milestone: P4
---

## Contexto
Compartir temporalmente sin crear cuentas adicionales.

## Alcance
- Tabla `shared_links` con `nanoid`, expiración y scopes.
- Tokens firmados (HMAC/JWT) y revocación.
- Auditoría de accesos.

## Tareas
- [ ] Migraciones y modelo.
- [ ] Endpoint de emisión/validación.
- [ ] UI para crear/revocar links.

## Criterios de aceptación
- [ ] Links expiran y se registran accesos.
