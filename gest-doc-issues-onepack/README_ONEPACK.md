# gest-doc — OnePack (issues + tareas + scripts)

Arrastra esta carpeta **gest-doc-issues-onepack/** a la **raíz** de tu repo y ejecútalo en **un clic**.

## Requisitos
- Tener instalado **GitHub CLI** y autenticado: `gh auth login`
- Abrir tu repo en **VS Code**
- (Opcional) Fijar repo por defecto: `gh repo set-default owner/repo`

## Uso en VS Code (un clic)
1. Abre el repo en VS Code (`code .`)
2. `Ctrl/Cmd + Shift + P` → **Tasks: Run Task**
3. Ejecuta una de estas opciones:
   - **OnePack (bash) — Crear labels, milestones e issues**
   - **OnePack (PowerShell) — Crear labels, milestones e issues**
4. Cuando te pida `owner/repo`, ingresa por ejemplo `miorg/gest-doc` o deja vacío si ya hiciste `gh repo set-default`.

## Alternativa por terminal
- **macOS/Linux**
  ```bash
  cd gest-doc-issues-onepack
  chmod +x scripts/*.sh
  ./scripts/create_all.sh owner/repo
  # o, si configuraste repo por defecto en gh:
  ./scripts/create_all.sh
  ```

- **Windows (PowerShell)**
  ```powershell
  cd gest-doc-issues-onepack
  # Bypass sólo en esta invocación
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\create_all.ps1 -Repo "owner/repo"
  # o, si ya configuraste repo por defecto:
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\create_all.ps1
  ```

## Notas
- Los scripts son **idempotentes** para labels/milestones; crear issues repetirá la creación si corres dos veces.
- Si PowerShell bloquea scripts descargados, el wrapper intenta `Unblock-File` y usa `-ExecutionPolicy Bypass`.
- Los issues están en la carpeta `issues/` en formato Markdown con frontmatter (title, labels, milestone).

¡Listo! Con este paquete el equipo puede cargar el roadmap como issues sin tocar configuraciones extra.
