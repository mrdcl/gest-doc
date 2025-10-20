---
title: P2 - Code-splitting por ruta y lazy-loading en visor/carga
labels: P2, frontend, performance, react
milestone: P2
---

## Contexto
Reducir Time-to-Interactive y peso inicial del bundle.

## Alcance
- Dividir rutas en chunks.
- Cargar visor PDF y modal de carga bajo demanda.
- Prefetch inteligente de rutas frecuentes.

## Tareas
- [ ] Config Vite para splitChunks.
- [ ] `React.lazy` y `Suspense` en componentes pesados.
- [ ] Medir antes/después con Web Vitals.

## Criterios de aceptación
- [ ] Reducción >=20% en JS inicial sin romper UX.
