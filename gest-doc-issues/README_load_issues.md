# Gest-Doc — Carga masiva de issues del roadmap

Este paquete crea **labels, milestones e issues** en tu repositorio GitHub usando **GitHub CLI (gh)**. Incluye tareas de **VS Code** para ejecutarlo fácilmente.

## Requisitos
- Tener instalado **GitHub CLI** (`gh`) y haber hecho `gh auth login`.
- Abrir la carpeta del repo (`gest-doc`) en VS Code.
- (Opcional) Establecer repo por defecto: `gh repo set-default <owner/repo>`
  - O pasar el repo con `-R <owner/repo>` en los scripts.

## Estructura
```
gest-doc-issues/
  issues/                # 22 issues como .md con frontmatter
  create_labels.sh       # Crea/actualiza labels estándar
  create_milestones.sh   # Crea milestones P0–P6
  create_issues.sh       # Lee issues/*.md y crea issues
  create_labels.ps1      # Equivalente para Windows
  create_milestones.ps1  # Equivalente para Windows
  create_issues.ps1      # Equivalente para Windows
  .vscode/tasks.json     # Tareas para ejecutar desde VS Code
```

## Uso rápido (VS Code)
1. Copia `gest-doc-issues/` a la **raíz de tu repo** (mismo nivel que `.git`).
2. En VS Code, pulsa **Ctrl/Cmd+Shift+P** → *Tasks: Run Task*.
3. Ejecuta en orden:
   - **GH: Crear labels (bash)** o **(PowerShell)** según tu plataforma.
   - **GH: Crear milestones (bash)** o **(PowerShell)**.
   - **GH: Crear issues (bash)** o **(PowerShell)**.
4. Verás las salidas con ✅ al finalizar.

> Si no tienes repo por defecto configurado, edita los scripts y agrega `-R owner/repo` a los comandos `gh` o ejecuta las tareas con el repositorio abierto y `gh repo set-default`.

## Personalización
- Edita los archivos en `issues/*.md` para cambiar títulos, etiquetas, milestone o el contenido.
- Puedes re-ejecutar scripts: `create_issues` crea issues nuevos; si repites, tendrás duplicados. Elimina/ajusta los que no necesites.

## Seguridad
Los scripts no suben PII ni secretos. Asegúrate de que tu **token de gh** tenga permisos para crear issues y milestones.

¡Listo!
