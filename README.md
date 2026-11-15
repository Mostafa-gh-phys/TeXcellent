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

The GitHub Actions workflow at `.github/workflows/build-desktop.yml` automatically builds desktop installers for Linux (`AppImage`), Windows (`.exe` NSIS + portable), and macOS (`.dmg` + `.zip`) on every push to `main` or `v*` release tag.

You can also publish TeXcellent directly to a new or existing GitHub repository from **Sync → GitHub → Publish App + Workflows** inside the app.
