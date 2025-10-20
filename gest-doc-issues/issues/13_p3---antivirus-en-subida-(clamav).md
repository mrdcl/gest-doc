---
title: P3 - Antivirus en subida (ClamAV)
labels: P3, security, ops
milestone: P3
---

## Contexto
Prevenir carga/descarga de archivos maliciosos.

## Alcance
- Contenedor/servicio ClamAV.
- Escaneo en subida y bloqueo ante positivos.
- Registro en `audit_logs` de resultados.

## Tareas
- [ ] Desplegar ClamAV.
- [ ] Integrar hook de escaneo en flujo de upload.
- [ ] Mensajería clara al usuario.

## Criterios de aceptación
- [ ] Archivos infectados se rechazan y auditan.
