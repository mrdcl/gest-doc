# Guía Rápida del Usuario - Sistema de Gestión Documental

## 📖 Introducción

Bienvenido al Sistema de Gestión Documental Corporativa. Esta herramienta te permite almacenar, organizar, buscar y compartir documentos de manera segura y eficiente.

## 🚀 Primeros Pasos

### 1. Crear una Cuenta

1. Accede a la aplicación
2. Haz clic en **"Registrarse"**
3. Completa el formulario:
   - **Nombre Completo**: Tu nombre y apellidos
   - **Correo Electrónico**: Tu email corporativo
   - **Contraseña**: Mínimo 6 caracteres
4. Haz clic en **"Crear Cuenta"**

### 2. Iniciar Sesión

1. Introduce tu correo y contraseña
2. Haz clic en **"Iniciar Sesión"**
3. Accederás al panel principal (Dashboard)

## 📤 Subir Documentos

### Pasos para Subir un Documento

1. **Haz clic en el botón "Subir"** (esquina superior derecha)
2. **Selecciona un archivo**:
   - Haz clic en el área punteada
   - Selecciona el archivo de tu computadora
   - Formatos soportados: PDF, Word, Excel, PowerPoint, imágenes, etc.
3. **Completa la información**:
   - **Título**: Nombre descriptivo del documento (se completa automáticamente)
   - **Descripción**: Descripción opcional del contenido
   - **Categoría**: Selecciona una categoría (Contratos, Facturas, RH, etc.)
   - **Estado**:
     - **Borrador**: Documento en proceso, solo tú puedes verlo
     - **Publicado**: Visible para todos los usuarios autorizados
4. **Haz clic en "Subir Documento"**

### Buenas Prácticas

- ✅ Usa nombres descriptivos y claros
- ✅ Agrega descripciones detalladas
- ✅ Selecciona la categoría correcta
- ✅ Publica solo documentos finalizados
- ❌ Evita caracteres especiales en nombres de archivo

## 🔍 Buscar Documentos

### Búsqueda Simple

1. Escribe en el **cuadro de búsqueda** en la parte superior
2. La búsqueda es en tiempo real (busca mientras escribes)
3. Busca por:
   - Título del documento
   - Descripción
   - Nombre del archivo

### Filtros Avanzados

Usa los filtros para refinar tu búsqueda:

1. **Por Categoría**:
   - Despliega el menú "Todas las categorías"
   - Selecciona una categoría específica

2. **Por Estado**:
   - Despliega el menú "Todos los estados"
   - Opciones: Borrador, Publicado, Archivado

3. **Combina filtros** para búsquedas más precisas

## 📋 Gestionar Documentos

### Acciones Disponibles

Cada documento tiene botones de acción en la columna derecha:

#### 👁️ Ver
- Visualiza la información del documento
- Registra automáticamente en auditoría

#### 📥 Descargar
- Descarga el archivo a tu computadora
- El archivo mantiene su nombre original

#### 🔗 Compartir
- Comparte el documento con otros usuarios
- Define permisos:
  - **Lectura**: Solo pueden ver
  - **Escritura**: Pueden editar
  - **Admin**: Control total

#### 🗑️ Eliminar
- Elimina permanentemente el documento
- **Solo el propietario puede eliminar**
- Requiere confirmación

## 📊 Entender la Vista de Documentos

### Columnas de la Tabla

1. **Documento**:
   - Título principal (en negrita)
   - Descripción (texto gris)
   - Nombre del archivo (texto pequeño)

2. **Categoría**:
   - Etiqueta con el nombre de la categoría
   - Icono de carpeta

3. **Estado**:
   - 🟢 **Verde**: Publicado
   - 🟡 **Amarillo**: Borrador
   - ⚫ **Gris**: Archivado

4. **Tamaño**:
   - Mostrado en KB o MB

5. **Fecha**:
   - Fecha y hora de creación

## 🔐 Seguridad y Privacidad

### Niveles de Acceso

Tu cuenta tiene uno de estos roles:

- **Usuario** (User): Acceso básico
  - Subir documentos propios
  - Ver documentos públicos o compartidos
  - Gestionar tus propios documentos

- **Manager**: Acceso extendido
  - Todo lo de Usuario
  - Ver documentos de su departamento
  - Gestionar accesos de su equipo

- **Administrador** (Admin): Acceso total
  - Todo lo anterior
  - Gestionar todas las categorías
  - Ver logs de auditoría
  - Acceso a todos los documentos

### Privacidad de Documentos

- **Documentos en Borrador**: Solo tú los ves
- **Documentos Publicados**: Visibles según permisos
- **Documentos Compartidos**: Visibles para usuarios autorizados
- **Auditoría**: Todas las acciones quedan registradas

## 🎯 Casos de Uso Comunes

### Caso 1: Subir un Contrato

1. Clic en "Subir"
2. Selecciona el archivo PDF del contrato
3. Título: "Contrato de Servicios - Cliente XYZ"
4. Descripción: "Contrato firmado el 15/10/2025"
5. Categoría: "Contratos"
6. Estado: "Publicado"
7. Clic en "Subir Documento"

### Caso 2: Compartir Factura con Contabilidad

1. Busca la factura
2. Clic en botón "Compartir" (🔗)
3. Selecciona usuario de contabilidad
4. Permiso: "Lectura"
5. Guardar

### Caso 3: Organizar Documentos de un Proyecto

1. Sube todos los documentos del proyecto
2. Usa la categoría "Proyectos"
3. Incluye el nombre del proyecto en el título
4. Ejemplo: "Proyecto Alpha - Especificaciones Técnicas"

## ❓ Preguntas Frecuentes

### ¿Qué tamaño máximo pueden tener los archivos?

El sistema maneja archivos de hasta 50 MB. Para archivos más grandes, contacta al administrador.

### ¿Puedo editar un documento después de subirlo?

Sí, puedes actualizar el título, descripción, categoría y estado. Para modificar el archivo, debes subir una nueva versión.

### ¿Qué pasa si elimino un documento por error?

Los administradores pueden recuperar documentos eliminados dentro de un periodo de gracia. Contacta a soporte inmediatamente.

### ¿Puedo descargar múltiples documentos a la vez?

Actualmente no, pero esta función está en desarrollo. Por ahora, descarga uno por uno.

### ¿Cómo sé quién tiene acceso a mis documentos?

Esta función estará disponible próximamente en la vista de detalles del documento.

### ¿Los documentos están respaldados?

Sí, todos los documentos tienen respaldo automático diario en Supabase.

## 📞 Soporte Técnico

Si tienes problemas o dudas:

1. **Verifica tu conexión a internet**
2. **Intenta cerrar sesión y volver a entrar**
3. **Limpia caché del navegador**
4. **Contacta al equipo de TI** si el problema persiste

## 💡 Consejos y Trucos

### ⚡ Atajos de Productividad

- Usa la búsqueda para encontrar documentos rápidamente
- Organiza por categorías desde el principio
- Agrega descripciones detalladas para facilitar búsquedas futuras
- Mantén documentos en borrador hasta estar seguros
- Revisa regularmente tus documentos archivados

### 🎨 Mejores Prácticas

1. **Nombrado Consistente**:
   ```
   ✅ Contrato_ClienteXYZ_2025-10-15.pdf
   ❌ contrato final v3 (copia).pdf
   ```

2. **Categorización**:
   - Asigna categorías inmediatamente
   - Usa la categoría más específica posible

3. **Descripciones**:
   - Incluye fechas relevantes
   - Menciona personas o departamentos involucrados
   - Agrega palabras clave para búsqueda

4. **Estados**:
   - Borrador: Documentos en proceso
   - Publicado: Documentos finales y validados
   - Archivado: Documentos antiguos pero importantes

## 🔄 Actualizaciones

El sistema se actualiza regularmente con nuevas funciones. Las actualizaciones recientes incluyen:

- ✅ Sistema de búsqueda mejorado
- ✅ Filtros por categoría y estado
- ✅ Auditoría de acciones
- 🔜 Previsualización de documentos
- 🔜 Notificaciones por email
- 🔜 Descarga masiva

---

**¡Disfruta utilizando el Sistema de Gestión Documental!**

Para sugerencias de mejora, contacta al equipo de desarrollo.
