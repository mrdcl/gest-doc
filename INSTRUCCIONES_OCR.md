# Instrucciones de Uso: Sistema OCR Integrado

## 🎯 Descripción General

El sistema ahora incluye **reconocimiento óptico de caracteres (OCR)** totalmente integrado que permite:
- ✅ Extraer texto automáticamente de documentos PDF e imágenes
- 🔍 Buscar contenido dentro de los documentos
- 📊 Indexar y consultar información de forma inteligente

---

## 🚀 Funcionalidades Implementadas

### 1. **OCR Automático al Subir Documentos**

Cuando subes un nuevo documento (PDF o imagen), el sistema automáticamente:
1. Detecta el tipo de archivo
2. Extrae el contenido de texto mediante OCR
3. Indexa el contenido en la base de datos
4. Lo hace disponible para búsqueda inmediata

**Tipos de archivo soportados:**
- 📄 PDF (application/pdf)
- 🖼️ Imágenes (image/jpg, image/png, image/jpeg, etc.)

**Proceso:**
```
Subir documento → Sistema detecta tipo → Procesa OCR en segundo plano → Contenido indexado
```

### 2. **Búsqueda de Contenido**

En el header del Dashboard, encontrarás el botón **"Buscar contenido"** (🔍):

**Cómo usar:**
1. Haz clic en el botón "Buscar contenido"
2. Ingresa los términos que deseas buscar
3. El sistema buscará en el contenido de TODOS los documentos
4. Verás resultados con:
   - Nombre del documento
   - Sociedad a la que pertenece
   - Tipo de gestión (Constitución, Modificación, etc.)
   - Número de página
   - Fragmento de texto con los términos resaltados
   - Fecha de subida

**Ejemplo de búsqueda:**
- Buscar "capital social" encontrará todos los documentos que mencionen este término
- Buscar "representante legal" mostrará todos los documentos relevantes
- Buscar números de RUT, fechas, nombres, etc.

### 3. **Reprocesamiento Masivo (Solo Admin y RC Abogados)**

Si eres administrador o usuario RC Abogados, verás un botón adicional **"OCR"** (🔄) en el header.

**Para reprocesar todos los documentos existentes:**

#### Opción A: Usar la Interfaz Gráfica
1. Haz clic en el botón "OCR" en el header
2. Lee la información y confirma la acción
3. El sistema procesará todos los documentos uno por uno
4. Verás el progreso en tiempo real
5. Al finalizar, verás un resumen con documentos exitosos y fallidos

#### Opción B: Usar la Consola del Navegador
1. Abre la aplicación en tu navegador
2. Abre las herramientas de desarrollo (F12)
3. Ve a la pestaña "Console"
4. Ejecuta el comando:
   ```javascript
   await window.reprocessAllDocuments()
   ```
5. Verás el progreso en la consola
6. Espera a que termine el proceso

**Importante:**
- El reprocesamiento puede tardar varios minutos
- No cierres el navegador durante el proceso
- Los documentos se procesan de forma secuencial para no sobrecargar el servidor

---

## 📋 Estado Actual del Sistema

### ✅ Documentos en Base de Datos
```
Total de documentos: 10
- PDFs: 10
- Imágenes: 0
- Otros: 0
```

### 🔧 Tecnología Utilizada

**OCR Engine:**
- **PDF**: pdf-parse (extracción nativa de texto)
- **Imágenes**: Tesseract.js (OCR de código abierto)
- **Idioma**: Español (configurado)

**Infraestructura:**
- Edge Function de Supabase para procesamiento
- Tabla `document_content_index` para almacenamiento
- Índices de búsqueda full-text en español
- Políticas RLS para seguridad

---

## 🎬 Cómo Empezar

### Primera Vez: Reprocesar Documentos Existentes

**Pasos recomendados:**

1. **Iniciar sesión como administrador**

2. **Ejecutar reprocesamiento:**
   - Opción fácil: Hacer clic en botón "OCR" → "Iniciar Reprocesamiento"
   - Opción avanzada: Abrir consola y ejecutar `await window.reprocessAllDocuments()`

3. **Esperar a que termine** (aprox. 2-5 minutos para 10 documentos)

4. **Verificar resultados:**
   - Haz clic en "Buscar contenido"
   - Ingresa un término común (ej: "sociedad", "representante")
   - Deberías ver resultados inmediatamente

### Uso Diario

**Subir nuevos documentos:**
1. Navega a Cliente → Sociedad → Gestión
2. Haz clic en "Subir documento"
3. Selecciona tu archivo y completa el formulario
4. El OCR se procesará automáticamente en segundo plano
5. El contenido estará disponible para búsqueda en 1-2 minutos

**Buscar contenido:**
1. Haz clic en "Buscar contenido" desde cualquier vista
2. Ingresa tus términos de búsqueda
3. Explora los resultados
4. (Funcionalidad de navegación directa: próximamente)

---

## 📊 Monitoreo y Logs

### Ver Logs en Tiempo Real

**En el navegador:**
1. Abre las herramientas de desarrollo (F12)
2. Ve a la pestaña "Console"
3. Verás mensajes como:
   ```
   📄 Procesando 5/10 (50.0%)
   ✅ OCR procesado exitosamente
   ```

**En Supabase:**
1. Ve a tu proyecto en Supabase
2. Navega a "Edge Functions" → "process-document-ocr"
3. Ve a "Logs" para ver el historial de procesamiento

### Verificar Contenido Indexado

**Query SQL para verificar:**
```sql
SELECT
  COUNT(*) as documentos_indexados,
  AVG(LENGTH(content_text)) as promedio_caracteres
FROM document_content_index;
```

---

## ⚠️ Solución de Problemas

### El OCR no se está ejecutando

**Verificar:**
1. Que el documento sea PDF o imagen
2. Que el usuario tenga permisos
3. Que la Edge Function esté desplegada:
   ```
   Supabase → Edge Functions → process-document-ocr → Debe estar "Deployed"
   ```

### La búsqueda no encuentra resultados

**Posibles causas:**
1. Los documentos aún no han sido procesados → Ejecutar reprocesamiento
2. El término buscado no existe en los documentos
3. Verificar que hay registros en `document_content_index`:
   ```sql
   SELECT COUNT(*) FROM document_content_index;
   ```

### El reprocesamiento es muy lento

**Esto es normal:**
- PDFs grandes pueden tardar 10-30 segundos cada uno
- Imágenes con mucho texto pueden tardar 20-60 segundos
- El procesamiento es secuencial para evitar sobrecargar el servidor

**Optimización futura:**
- Implementar cola de procesamiento
- Procesamiento paralelo con límite de concurrencia
- Cache de resultados OCR

---

## 🔮 Próximas Mejoras

**En desarrollo:**
- [ ] Navegación directa al documento desde resultados de búsqueda
- [ ] Resaltado de términos en el visor de PDF
- [ ] Procesamiento por lotes más rápido
- [ ] Extracción de metadatos estructurados (fechas, RUTs, nombres)
- [ ] Búsqueda avanzada con filtros (por tipo, por fecha, por sociedad)
- [ ] API de búsqueda para integraciones

---

## 📞 Soporte

**Si encuentras problemas:**
1. Revisa los logs en la consola del navegador
2. Verifica los logs de la Edge Function en Supabase
3. Consulta esta documentación
4. Contacta al equipo de desarrollo

---

## 🎉 ¡Listo para Usar!

El sistema OCR está completamente funcional. Simplemente:

1. **Haz clic en el botón "OCR"** en el header
2. **Confirma el reprocesamiento**
3. **Espera 2-5 minutos**
4. **Comienza a buscar** contenido en tus documentos

¡Disfruta de la búsqueda inteligente en tu gestión documental!
