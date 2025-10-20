---
title: P0 - Telemetría base con PostHog
labels: P0, observability, analytics
milestone: P0
---

## Contexto
Medir TTFV, funnels críticos (upload, share), errores y uso de búsqueda.

## Alcance
- Integrar `posthog-js` en app.
- Eventos: `upload_started/success`, `share_opened/confirmed`, `search_performed`, `doc_viewed`, errores.
- Respeto a consentimiento (opt-in/out).

## Tareas
- [ ] Configurar llave y entorno.
- [ ] Instrumentar eventos y userId anónimo.
- [ ] Dashboard inicial en PostHog.
- [ ] Documentar convenciones de eventos.

## Criterios de aceptación
- [ ] Dashboards muestran eventos por día/usuario.
- [ ] Sin PII en eventos por defecto.
