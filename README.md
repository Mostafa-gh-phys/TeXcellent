# TeXcellent

**TeXcellent** is a minimal, bilingual LaTeX studio built for both academic English and Persian/Arabic (`XePersian`) workflows, featuring:

- **Local TeX Live & MiKTeX Autodetection**: Automatically scans system `PATH` and standard TeX Live (`2020–2026`) / MiKTeX installation paths on Linux, macOS, and Windows, with edition (`Full`, `Medium`, `Basic`) and engine (`XeLaTeX`, `PDFLaTeX`, `LuaLaTeX`, `LaTeX`, `Latexmk`) switching.
- **BiDi-Aware Code Editor**: Synchronizes CodeMirror 6 `EditorView.bidiIsolatedRanges` with per-line direction detection so `\section{درس های متنی}` keeps LaTeX commands LTR while inner RTL text types naturally, alongside customizable editor themes and monospace/RTL fonts.
- **Beside & External PDF Preview**: Instant KaTeX + structural preview alongside compiled PDF binary view and pop-out external preview window.
- **Image to LaTeX (Online & Local AI)**: Transcribe handwritten formulas, tables, or Persian academic pages via server-side Gemini Vision or local Ollama / OpenAI-compatible vision endpoints.
- **Cloud Sync, Import & GitHub Publishing**: Import/export `.zip` or `.tex`/`.bib` archives, push/pull via Overleaf Git Bridge or `easytex.ir`, and publish projects or the full TeXcellent desktop build workflow to GitHub.

## Running Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Desktop Installers (`.AppImage`, `.exe`, `.dmg`)

The repository includes a battle-tested multi-OS GitHub Actions workflow at [`.github/workflows/build-desktop.yml`](.github/workflows/build-desktop.yml) that packages standalone desktop installers:
- **Linux**: Standalone `.AppImage` (x64) and portable `.tar.gz`
- **Windows**: NSIS installation setup (`.exe`) and portable standalone (`.exe`)
- **macOS**: Apple disk image (`.dmg`) and portable application archive (`.zip`) for both Apple Silicon (ARM64) and Intel (x64)

### Automated GitHub Builds & Releases
1. **Push to `main`**: Automatically runs typechecks, unit tests, and compiles desktop installer artifacts uploaded directly to the Actions run summary.
2. **Push a Release Tag** (e.g. `git tag v1.0.0 && git push origin v1.0.0`): Automatically creates a formal GitHub Release and attaches all cross-platform installers.
3. **Manual Trigger (Actions Web UI)**: Navigate to **Actions → Build TeXcellent Desktop Installers → Run workflow**, where you can check **"Publish a GitHub Release"** to build and release installers immediately.

### Building Desktop Locally
```bash
# 1. Build frontend and self-contained Express server
npm run build
npm run build:server

# 2. Package for your current operating system
npx electron-builder --config electron-builder.yml
```
Installers will be generated in the `release/` directory.
