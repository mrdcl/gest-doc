---
title: P5 - Resúmenes post-upload con workers (BullMQ + Redis)
labels: P5, ai, workers, redis, bullmq
milestone: P5
---

## Contexto
Generar metadatos enriquecidos y resúmenes automáticamente.

## Alcance
- Workers para OCR, resumen, extracción de entidades.
- Colas BullMQ + Redis y reintentos.
- Toasts de progreso y logs.

## Tareas
- [ ] Desplegar Redis y workers.
- [ ] Jobs por tipo de documento.
- [ ] Notificaciones de finalización.

## Criterios de aceptación
- [ ] Resúmenes y entidades disponibles en ficha del documento.
