import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Play,
  PanelLeft,
  Plus,
  Trash2,
  FileCode2,
  Terminal,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
} from 'lucide-react';
import {
  CompilerMode,
  CompilerSettings,
  CompileResult,
  DetectedTexInstallation,
  DirectionMode,
  EditorFontId,
  LatexProject,
  PreviewMode,
  ProjectFile,
  SyncConfig,
  ThemeId,
} from './types/latex';
import { EDITOR_THEMES } from './utils/themes';
import { EDITOR_FONTS } from './utils/editorFonts';
import { createInitialProject, ProjectTemplate } from './utils/defaultProjects';
import { LatexCodeEditor } from './components/LatexCodeEditor';
import { PdfPreviewPane } from './components/PdfPreviewPane';
import { SmartAiModal } from './components/SmartAiModal';
import { SyncModal } from './components/SyncModal';
import { CompilerSettingsModal } from './components/CompilerSettingsModal';
import { FileModal } from './components/FileModal';
import { SettingsModal } from './components/SettingsModal';
import { TeXcellentLogo } from './components/TeXcellentLogo';

const STORAGE_PROJECT_KEY = 'texcellent_project_v1';
const STORAGE_THEME_KEY = 'texcellent_theme_v1';
const STORAGE_FONT_KEY = 'texcellent_font_v1';
const STORAGE_FONT_SIZE_KEY = 'texcellent_font_size_v1';
const STORAGE_BIDI_KEY = 'texcellent_bidi_v1';
const STORAGE_COMPILER_KEY = 'texcellent_compiler_v1';
const STORAGE_SYNC_KEY = 'texcellent_sync_v1';

const LEGACY_KEYS: Record<string, string> = {
  [STORAGE_PROJECT_KEY]: 'texmatch_project_v1',
  [STORAGE_THEME_KEY]: 'texmatch_theme_v1',
  [STORAGE_FONT_KEY]: 'texmatch_font_v1',
  [STORAGE_FONT_SIZE_KEY]: 'texmatch_font_size_v1',
  [STORAGE_COMPILER_KEY]: 'texmatch_compiler_v1',
  [STORAGE_SYNC_KEY]: 'texmatch_sync_v1',
};

const DEFAULT_COMPILER_SETTINGS: CompilerSettings = {
  distribution: 'texlive-2025',
  edition: 'full',
  compilerMode: 'xelatex',
  customBinaryPath: '',
  remoteEndpointUrl: '',
  shellEscape: false,
  synctex: true,
};

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  github: {
    connected: false,
    username: '',
    token: '',
    repo: '',
    branch: 'main',
    basePath: '',
  },
  overleaf: {
    projectId: '',
    gitToken: '',
    customHost: 'https://git.overleaf.com',
  },
  easytex: {
    projectUrl: '',
    apiToken: '',
    instanceUrl: 'https://easytex.ir',
  },
};

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key) ?? (LEGACY_KEYS[key] ? localStorage.getItem(LEGACY_KEYS[key]) : null);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const isExternalPreviewWindow =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('preview') === 'external';

  const [project, setProject] = useState<LatexProject>(() =>
    loadJson<LatexProject>(STORAGE_PROJECT_KEY, createInitialProject())
  );
  const [activeFileId, setActiveFileId] = useState<string>(
    () => project.mainFileId || project.files[0]?.id || 'main-tex'
  );
  const [themeId, setThemeId] = useState<ThemeId>(
    () => loadJson<ThemeId>(STORAGE_THEME_KEY, 'github-light')
  );
  const [editorFontId, setEditorFontId] = useState<EditorFontId>(
    () => loadJson<EditorFontId>(STORAGE_FONT_KEY, 'jetbrains')
  );
  const [editorFontSize, setEditorFontSize] = useState<number>(
    () => loadJson<number>(STORAGE_FONT_SIZE_KEY, 14)
  );
  const [compilerSettings, setCompilerSettings] = useState<CompilerSettings>(
    () => loadJson<CompilerSettings>(STORAGE_COMPILER_KEY, DEFAULT_COMPILER_SETTINGS)
  );
  const [detectedTex, setDetectedTex] = useState<DetectedTexInstallation | null>(null);
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(
    () => loadJson<SyncConfig>(STORAGE_SYNC_KEY, DEFAULT_SYNC_CONFIG)
  );

  const [directionMode, setDirectionMode] = useState<DirectionMode>(
    () => loadJson<DirectionMode>(STORAGE_BIDI_KEY, 'auto')
  );
  const [previewMode, setPreviewMode] = useState<PreviewMode>('beside');
  const [mobilePane, setMobilePane] = useState<'editor' | 'preview'>('editor');
  const [showSidebar, setShowSidebar] = useState<boolean>(true);
  const [showLog, setShowLog] = useState<boolean>(false);
  const [splitRatio, setSplitRatio] = useState<number>(50);

  const [cursorInfo, setCursorInfo] = useState<{
    line: number;
    col: number;
    detectedDir: 'ltr' | 'rtl';
  }>({ line: 1, col: 1, detectedDir: 'ltr' });
  const [keyboardScript, setKeyboardScript] = useState<'ltr' | 'rtl'>('ltr');

  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);

  const [activeModal, setActiveModal] = useState<
    null | 'file' | 'smart' | 'sync' | 'compiler' | 'settings' | 'external-fallback'
  >(null);
  const [newFileName, setNewFileName] = useState('');
  const [isAddingFile, setIsAddingFile] = useState(false);

  const editorActionsRef = useRef<{ insertAtCursor: (snippet: string) => void } | null>(null);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const isResizingRef = useRef(false);

  const theme = EDITOR_THEMES[themeId] || EDITOR_THEMES['github-light'];
  const editorFont = EDITOR_FONTS[editorFontId] || EDITOR_FONTS.jetbrains;
  const activeFile =
    project.files.find((f) => f.id === activeFileId) || project.files[0];
  const mainFile =
    project.files.find((f) => f.id === project.mainFileId) || project.files[0];

  // Persist workspace state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PROJECT_KEY, JSON.stringify(project));
    } catch {
      // ignore storage quota errors
    }
  }, [project]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_THEME_KEY, JSON.stringify(themeId));
    } catch {
      // ignore
    }
  }, [themeId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FONT_KEY, JSON.stringify(editorFontId));
    } catch {
      // ignore
    }
  }, [editorFontId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FONT_SIZE_KEY, JSON.stringify(editorFontSize));
    } catch {
      // ignore
    }
  }, [editorFontSize]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_COMPILER_KEY, JSON.stringify(compilerSettings));
    } catch {
      // ignore
    }
  }, [compilerSettings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SYNC_KEY, JSON.stringify(syncConfig));
    } catch {
      // ignore
    }
  }, [syncConfig]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_BIDI_KEY, JSON.stringify(directionMode));
    } catch {
      // ignore
    }
  }, [directionMode]);

  // Sync external preview window via BroadcastChannel
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('texcellent-preview');
    if (isExternalPreviewWindow) {
      channel.onmessage = (e) => {
        if (e.data?.type === 'SYNC_PREVIEW') {
          setProject(e.data.project);
          setCompileResult(e.data.compileResult);
          setThemeId(e.data.themeId);
        }
      };
      channel.postMessage({ type: 'REQUEST_SYNC' });
    } else {
      channel.onmessage = (e) => {
        if (e.data?.type === 'REQUEST_SYNC') {
          channel.postMessage({
            type: 'SYNC_PREVIEW',
            project,
            compileResult,
            themeId,
          });
        }
      };
      channel.postMessage({
        type: 'SYNC_PREVIEW',
        project,
        compileResult,
        themeId,
      });
    }
    return () => channel.close();
  }, [isExternalPreviewWindow, project, compileResult, themeId]);

  const handleCompile = useCallback(async () => {
    setIsCompiling(true);
    try {
      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: project.name,
          mainFileName: mainFile?.name || 'main.tex',
          files: project.files,
          mode: compilerSettings.compilerMode,
          distribution: compilerSettings.distribution,
          edition: compilerSettings.edition,
          customBinaryPath: compilerSettings.customBinaryPath,
          remoteEndpointUrl: compilerSettings.remoteEndpointUrl,
          shellEscape: compilerSettings.shellEscape,
          synctex: compilerSettings.synctex,
        }),
      });
      const data = (await res.json()) as CompileResult;
      setCompileResult(data);
      if (!data.success) {
        setShowLog(true);
      }
    } catch (err) {
      console.error('Compile failed:', err);
    } finally {
      setIsCompiling(false);
    }
  }, [project, mainFile, compilerSettings]);

  const detectLocalCompilers = useCallback(async (customDir?: string) => {
    try {
      const res = await fetch(
        `/api/compiler/status?customDir=${encodeURIComponent(customDir || '')}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as DetectedTexInstallation;
      setDetectedTex(data);
      if (data.hasNative) {
        setCompilerSettings((prev) => ({
          ...prev,
          distribution: data.detectedDistribution || prev.distribution,
          customBinaryPath: prev.customBinaryPath || data.detectedBinDir || '',
        }));
      }
    } catch {
      // ignore network error during startup detection
    }
  }, []);

  // Initial compile + local TeX Live / MiKTeX autodetection on mount
  useEffect(() => {
    if (!isExternalPreviewWindow) {
      detectLocalCompilers(compilerSettings.customBinaryPath);
      handleCompile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Split pane drag handlers
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizingRef.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitRatio(Math.min(72, Math.max(28, pct)));
    };
    const onUp = () => {
      isResizingRef.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const handleFileContentChange = (nextContent: string) => {
    if (!activeFile) return;
    const now = new Date().toISOString();
    setProject((prev) => ({
      ...prev,
      updatedAt: now,
      files: prev.files.map((f) =>
        f.id === activeFile.id ? { ...f, content: nextContent, updatedAt: now } : f
      ),
    }));
  };

  const handleAddFile = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newFileName.trim();
    if (!clean) return;
    const finalName = /\.(tex|bib|sty|cls)$/i.test(clean) ? clean : `${clean}.tex`;
    const newFile: ProjectFile = {
      id: `file-${Date.now()}`,
      name: finalName,
      content: finalName.endsWith('.bib')
        ? `@article{key2026,\n  author = {Author},\n  title = {Title},\n  year = {2026}\n}\n`
        : `% ${finalName}\n\\section{New Section}\n`,
      language: finalName.endsWith('.bib') ? 'bibtex' : finalName.endsWith('.sty') || finalName.endsWith('.cls') ? 'style' : 'latex',
      updatedAt: new Date().toISOString(),
    };
    setProject((prev) => ({
      ...prev,
      files: [...prev.files, newFile],
      updatedAt: new Date().toISOString(),
    }));
    setActiveFileId(newFile.id);
    setNewFileName('');
    setIsAddingFile(false);
  };

  const handleDeleteFile = (fileId: string) => {
    if (project.files.length <= 1 || fileId === project.mainFileId) return;
    const remaining = project.files.filter((f) => f.id !== fileId);
    setProject((prev) => ({
      ...prev,
      files: remaining,
      updatedAt: new Date().toISOString(),
    }));
    if (activeFileId === fileId) {
      setActiveFileId(remaining[0].id);
    }
  };

  const handleSelectTemplate = (tpl: ProjectTemplate) => {
    const nextProject: LatexProject = {
      id: `proj-${Date.now()}`,
      ...tpl.project,
      updatedAt: new Date().toISOString(),
    };
    setProject(nextProject);
    setActiveFileId(nextProject.mainFileId);
    setCompilerSettings((prev) => ({
      ...prev,
      compilerMode: tpl.project.compilerMode,
      distribution: tpl.project.distribution,
      edition: tpl.project.edition,
    }));
    setTimeout(() => {
      handleCompile();
    }, 60);
  };

  const handleImportFiles = (incoming: ProjectFile[]) => {
    if (!incoming.length) return;
    setProject((prev) => {
      const merged = [...prev.files];
      for (const file of incoming) {
        const idx = merged.findIndex((f) => f.name === file.name);
        if (idx !== -1) {
          merged[idx] = { ...merged[idx], content: file.content, updatedAt: file.updatedAt };
        } else {
          merged.push(file);
        }
      }
      return { ...prev, files: merged, updatedAt: new Date().toISOString() };
    });
    setActiveFileId(incoming[0].id);
  };

  const handleCreateFile = (finalName: string, content?: string) => {
    const newFile: ProjectFile = {
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: finalName,
      content:
        content ??
        (finalName.endsWith('.bib')
          ? `@article{key2026,\n  author = {Author},\n  title = {Title},\n  year = {2026}\n}\n`
          : `% ${finalName}\n\\section{New Section}\n`),
      language: finalName.endsWith('.bib')
        ? 'bibtex'
        : finalName.endsWith('.sty') || finalName.endsWith('.cls')
          ? 'style'
          : 'latex',
      updatedAt: new Date().toISOString(),
    };
    setProject((prev) => ({
      ...prev,
      files: [...prev.files, newFile],
      updatedAt: new Date().toISOString(),
    }));
    setActiveFileId(newFile.id);
  };

  const handleNewBlankProject = (projectName: string) => {
    const mainId = `main-${Date.now()}`;
    const blankContent = `\\documentclass[12pt,a4paper]{article}
\\usepackage{amsmath,amssymb}
\\title{${projectName.replace(/[{}]/g, '')}}
\\author{Author}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Introduction}
Write your document here.

\\end{document}
`;
    const nextProject: LatexProject = {
      id: `proj-${Date.now()}`,
      name: projectName,
      mainFileId: mainId,
      compilerMode: compilerSettings.compilerMode,
      distribution: compilerSettings.distribution,
      edition: compilerSettings.edition,
      updatedAt: new Date().toISOString(),
      files: [
        {
          id: mainId,
          name: 'main.tex',
          content: blankContent,
          language: 'latex',
          updatedAt: new Date().toISOString(),
        },
      ],
    };
    setProject(nextProject);
    setActiveFileId(mainId);
    setTimeout(() => {
      handleCompile();
    }, 60);
  };

  const handleOpenExternalPreview = () => {
    const url = `${window.location.origin}${window.location.pathname}?preview=external`;
    const win = window.open(url, 'texcellent_external_preview', 'width=900,height=1000');
    if (!win) {
      setActiveModal('external-fallback');
    }
  };

  if (isExternalPreviewWindow) {
    return (
      <div className="h-screen w-screen overflow-hidden" style={{ backgroundColor: theme.ui.bg }}>
        <PdfPreviewPane
          source={mainFile?.content || ''}
          compileResult={compileResult}
          isCompiling={isCompiling}
          theme={theme}
          onOpenExternal={() => {}}
          onRecompile={handleCompile}
          isExternalWindow
        />
      </div>
    );
  }

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden"
      style={{
        backgroundColor: theme.ui.bg,
        color: theme.ui.text,
      }}
    >
      {/* Top Bar: Left = Navigation Tabs · Center = TeXcellent Logo & Name · Right = Compile CTA */}
      <header
        className="flex md:grid md:grid-cols-3 items-center justify-between gap-4 px-5 py-2.5 border-b shrink-0"
        style={{
          backgroundColor: theme.ui.bg,
          borderColor: theme.ui.border,
        }}
      >
        <nav className="hidden md:flex items-center gap-5 text-sm font-medium justify-self-start">
          <button
            type="button"
            onClick={() => setActiveModal('file')}
            className="hover:underline underline-offset-4 whitespace-nowrap shrink-0 transition-colors"
            style={{ color: theme.ui.textMuted }}
          >
            File
          </button>
          <button
            type="button"
            onClick={() => setActiveModal('smart')}
            className="hover:underline underline-offset-4 whitespace-nowrap shrink-0 transition-colors"
            style={{ color: theme.ui.textMuted }}
          >
            Smart(+AI)
          </button>
          <button
            type="button"
            onClick={() => setActiveModal('sync')}
            className="hover:underline underline-offset-4 whitespace-nowrap shrink-0 transition-colors"
            style={{ color: theme.ui.textMuted }}
          >
            Sync
          </button>
          <button
            type="button"
            onClick={() => setActiveModal('compiler')}
            className="hover:underline underline-offset-4 whitespace-nowrap shrink-0 transition-colors"
            style={{ color: theme.ui.textMuted }}
          >
            Compiler
          </button>
          <button
            type="button"
            onClick={() => setActiveModal('settings')}
            className="hover:underline underline-offset-4 whitespace-nowrap shrink-0 transition-colors"
            style={{ color: theme.ui.textMuted }}
          >
            Settings
          </button>
        </nav>

        <a
          href="/"
          onClick={(e) => e.preventDefault()}
          aria-label="TeXcellent"
          className="inline-flex items-center justify-center whitespace-nowrap shrink-0 md:justify-self-center hover:opacity-90 transition-opacity"
        >
          <TeXcellentLogo
            accentColor={theme.ui.accent}
            textColor={theme.ui.text}
            height={30}
          />
        </a>

        <div className="flex items-center justify-self-end shrink-0">
          <button
            type="button"
            onClick={handleCompile}
            disabled={isCompiling}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-opacity disabled:opacity-60"
            style={{
              backgroundColor: theme.ui.accent,
              color: theme.ui.accentFg,
            }}
          >
            {isCompiling ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            Compile PDF
          </button>
        </div>
      </header>

      {/* Secondary Workspace Controls Bar */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-2 border-b overflow-x-auto shrink-0"
        style={{
          backgroundColor: theme.ui.surface,
          borderColor: theme.ui.border,
        }}
      >
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            aria-label="Toggle project files sidebar"
            onClick={() => setShowSidebar((v) => !v)}
            className="hidden sm:inline-flex p-1.5 rounded border"
            style={{
              borderColor: theme.ui.border,
              backgroundColor: theme.ui.bg,
              color: theme.ui.text,
            }}
          >
            <PanelLeft className="w-3.5 h-3.5" />
          </button>

          <span className="hidden sm:inline text-xs font-semibold truncate max-w-[200px]" title={project.name}>
            {project.name}
          </span>

          {/* Quick mobile action triggers */}
          <div className="flex md:hidden items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveModal('file')}
              className="px-2 py-1 text-xs rounded border whitespace-nowrap"
              style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.bg }}
            >
              File
            </button>
            <button
              type="button"
              onClick={() => setActiveModal('smart')}
              className="px-2 py-1 text-xs rounded border whitespace-nowrap"
              style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.bg }}
            >
              Smart
            </button>
            <button
              type="button"
              onClick={() => setActiveModal('sync')}
              className="px-2 py-1 text-xs rounded border whitespace-nowrap"
              style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.bg }}
            >
              Sync
            </button>
            <button
              type="button"
              onClick={() => setActiveModal('compiler')}
              className="px-2 py-1 text-xs rounded border whitespace-nowrap"
              style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.bg }}
            >
              Compiler
            </button>
            <button
              type="button"
              onClick={() => setActiveModal('settings')}
              className="px-2 py-1 text-xs rounded border whitespace-nowrap"
              style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.bg }}
            >
              Settings
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Compiler Mode Selector */}
          <div className="flex items-center gap-1">
            <label htmlFor="toolbar-engine" className="sr-only">
              Compiler Mode
            </label>
            <select
              id="toolbar-engine"
              aria-label="Compiler Mode"
              value={compilerSettings.compilerMode}
              onChange={(e) =>
                setCompilerSettings((prev) => ({
                  ...prev,
                  compilerMode: e.target.value as CompilerMode,
                }))
              }
              className="px-2.5 py-1 text-xs font-medium rounded border outline-none"
              style={{
                backgroundColor: theme.ui.bg,
                borderColor: theme.ui.border,
                color: theme.ui.text,
              }}
            >
              <option value="xelatex">XeLaTeX</option>
              <option value="pdflatex">PDFLaTeX</option>
              <option value="lualatex">LuaLaTeX</option>
              <option value="latex">LaTeX (DVI)</option>
              <option value="latexmk">Latexmk</option>
            </select>
          </div>

          {/* Distribution & Edition Quick Display Button */}
          <button
            type="button"
            onClick={() => setActiveModal('compiler')}
            className="hidden sm:inline-flex items-center px-2.5 py-1 text-xs rounded border whitespace-nowrap"
            style={{
              backgroundColor: theme.ui.bg,
              borderColor: theme.ui.border,
              color: theme.ui.textMuted,
            }}
          >
            {compilerSettings.distribution.startsWith('miktex') ? 'MiKTeX' : 'TeX Live'} ·{' '}
            {compilerSettings.edition.charAt(0).toUpperCase() + compilerSettings.edition.slice(1)}
          </button>

          {/* Preview Layout Switch (Desktop) */}
          <div
            className="hidden md:flex items-center p-0.5 rounded border"
            style={{ backgroundColor: theme.ui.surfaceAlt, borderColor: theme.ui.border }}
          >
            <button
              type="button"
              onClick={() => setPreviewMode('beside')}
              className="px-2.5 py-0.5 text-xs font-medium rounded whitespace-nowrap"
              style={{
                backgroundColor: previewMode === 'beside' ? theme.ui.bg : 'transparent',
                color: previewMode === 'beside' ? theme.ui.text : theme.ui.textMuted,
              }}
            >
              Beside
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('editor-only')}
              className="px-2.5 py-0.5 text-xs font-medium rounded whitespace-nowrap"
              style={{
                backgroundColor: previewMode === 'editor-only' ? theme.ui.bg : 'transparent',
                color: previewMode === 'editor-only' ? theme.ui.text : theme.ui.textMuted,
              }}
            >
              Editor
            </button>
          </div>

          {/* Mobile Editor/Preview Switch */}
          <div
            className="flex md:hidden items-center p-0.5 rounded border"
            style={{ backgroundColor: theme.ui.surfaceAlt, borderColor: theme.ui.border }}
          >
            <button
              type="button"
              onClick={() => setMobilePane('editor')}
              className="px-2 py-0.5 text-xs font-medium rounded"
              style={{
                backgroundColor: mobilePane === 'editor' ? theme.ui.bg : 'transparent',
                color: mobilePane === 'editor' ? theme.ui.text : theme.ui.textMuted,
              }}
            >
              Code
            </button>
            <button
              type="button"
              onClick={() => setMobilePane('preview')}
              className="px-2 py-0.5 text-xs font-medium rounded"
              style={{
                backgroundColor: mobilePane === 'preview' ? theme.ui.bg : 'transparent',
                color: mobilePane === 'preview' ? theme.ui.text : theme.ui.textMuted,
              }}
            >
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Main Split Workspace */}
      <main className="flex-1 flex min-h-0 overflow-hidden">
        {/* Project Files Sidebar */}
        {showSidebar && (
          <aside
            aria-label="Project Files"
            className="w-52 border-r flex flex-col shrink-0 hidden sm:flex"
            style={{
              backgroundColor: theme.ui.surface,
              borderColor: theme.ui.border,
            }}
          >
            <div
              className="flex items-center justify-between px-3 py-2 border-b"
              style={{ borderColor: theme.ui.border }}
            >
              <span className="text-xs font-semibold" style={{ color: theme.ui.textMuted }}>
                Project Files
              </span>
              <button
                type="button"
                aria-label="New project file"
                onClick={() => setIsAddingFile((v) => !v)}
                className="p-1 rounded hover:opacity-75"
                style={{ color: theme.ui.textMuted }}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {isAddingFile && (
              <form
                onSubmit={handleAddFile}
                className="p-2 border-b flex gap-1"
                style={{ borderColor: theme.ui.border }}
              >
                <input
                  type="text"
                  aria-label="New filename"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="chapter1.tex"
                  autoFocus
                  className="flex-1 min-w-0 px-2 py-1 text-xs font-mono rounded border"
                  style={{
                    backgroundColor: theme.ui.bg,
                    borderColor: theme.ui.border,
                    color: theme.ui.text,
                  }}
                />
                <button
                  type="submit"
                  className="px-2 py-1 text-xs font-medium rounded"
                  style={{ backgroundColor: theme.ui.accent, color: theme.ui.accentFg }}
                >
                  Add
                </button>
              </form>
            )}

            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
              {project.files.map((file) => {
                const isActive = file.id === activeFile?.id;
                const isMain = file.id === project.mainFileId;
                return (
                  <div
                    key={file.id}
                    className="group flex items-center justify-between rounded-md px-2 py-1.5"
                    style={{
                      backgroundColor: isActive ? theme.ui.surfaceAlt : 'transparent',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveFileId(file.id)}
                      className="flex items-center gap-2 text-left text-xs min-w-0 flex-1"
                      style={{
                        color: isActive ? theme.ui.text : theme.ui.textMuted,
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate font-mono">{file.name}</span>
                    </button>
                    {!isMain && project.files.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Delete ${file.name}`}
                        onClick={() => handleDeleteFile(file.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-500"
                        style={{ color: theme.ui.textMuted }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        {/* Editor + Beside Preview Split */}
        <div ref={splitContainerRef} className="flex-1 flex min-w-0 min-h-0 overflow-hidden">
          {/* Code Editor Pane */}
          <section
            aria-label="LaTeX Code Editor Pane"
            className={`flex flex-col min-w-0 min-h-0 ${
              mobilePane === 'preview' ? 'hidden md:flex' : 'flex'
            } ${previewMode === 'beside' ? 'w-full md:w-[var(--editor-w)]' : 'w-full flex-1'}`}
            style={
              previewMode === 'beside'
                ? ({ '--editor-w': `${splitRatio}%` } as React.CSSProperties)
                : undefined
            }
          >
            <div className="flex-1 min-h-0 overflow-hidden">
              {activeFile && (
                <LatexCodeEditor
                  value={activeFile.content}
                  onChange={handleFileContentChange}
                  theme={theme}
                  editorFont={editorFont}
                  editorFontSize={editorFontSize}
                  directionMode={directionMode}
                  files={project.files}
                  onCursorInfo={setCursorInfo}
                  onScriptDetected={setKeyboardScript}
                  editorRefOut={editorActionsRef}
                />
              )}
            </div>

            {/* Collapsible Compiler Log Drawer */}
            {showLog && compileResult && (
              <div
                aria-label="Compiler Output Log"
                className="h-44 border-t overflow-y-auto p-3 font-mono text-xs shrink-0"
                style={{
                  backgroundColor: theme.ui.surface,
                  borderColor: theme.ui.border,
                  color: theme.ui.text,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">
                    Compiler Output · {compileResult.engineLabel} · {compileResult.distributionLabel}
                  </span>
                  <button
                    type="button"
                    aria-label="Close compiler log"
                    onClick={() => setShowLog(false)}
                    className="p-0.5 rounded hover:opacity-75"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <pre className="whitespace-pre-wrap leading-relaxed opacity-90">
                  {compileResult.rawLog}
                </pre>
              </div>
            )}

            {/* Quiet Editor Footer */}
            <div
              className="flex items-center justify-between px-3 py-1.5 border-t text-[11px] shrink-0"
              style={{
                backgroundColor: theme.ui.surface,
                borderColor: theme.ui.border,
                color: theme.ui.textMuted,
              }}
            >
              <div className="flex items-center gap-3 tabular-nums">
                <span>
                  Ln {cursorInfo.line}, Col {cursorInfo.col}
                </span>
                <span aria-hidden="true">·</span>
                <span>Line Dir: {cursorInfo.detectedDir.toUpperCase()}</span>
                <span aria-hidden="true">·</span>
                <span>Input Script: {keyboardScript.toUpperCase()}</span>
              </div>

              <button
                type="button"
                onClick={() => setShowLog((v) => !v)}
                className="inline-flex items-center gap-1 hover:underline"
                style={{ color: theme.ui.text }}
              >
                <Terminal className="w-3 h-3" />
                <span>Log</span>
                {showLog ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronUp className="w-3 h-3" />
                )}
              </button>
            </div>
          </section>

          {/* Resizable Divider */}
          {previewMode === 'beside' && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize editor and preview panes"
              onMouseDown={() => {
                isResizingRef.current = true;
              }}
              className="hidden md:block w-1 cursor-col-resize shrink-0 transition-colors hover:opacity-80"
              style={{ backgroundColor: theme.ui.border }}
            />
          )}

          {/* Beside PDF Preview Pane */}
          {previewMode === 'beside' && (
            <section
              aria-label="PDF Preview Pane"
              className={`flex-1 min-w-0 min-h-0 ${
                mobilePane === 'editor' ? 'hidden md:flex' : 'flex'
              } flex-col`}
            >
              <PdfPreviewPane
                source={mainFile?.content || ''}
                compileResult={compileResult}
                isCompiling={isCompiling}
                theme={theme}
                onOpenExternal={handleOpenExternalPreview}
                onRecompile={handleCompile}
              />
            </section>
          )}
        </div>
      </main>

      {/* Modals */}
      <FileModal
        isOpen={activeModal === 'file'}
        onClose={() => setActiveModal(null)}
        theme={theme}
        project={project}
        activeFile={activeFile}
        onCreateFile={handleCreateFile}
        onNewBlankProject={handleNewBlankProject}
        onSelectTemplate={handleSelectTemplate}
        onImportFiles={handleImportFiles}
      />

      <SmartAiModal
        isOpen={activeModal === 'smart'}
        onClose={() => setActiveModal(null)}
        theme={theme}
        compilerMode={compilerSettings.compilerMode}
        activeFileContent={activeFile?.content || ''}
        onInsertLatex={(snippet) => {
          editorActionsRef.current?.insertAtCursor(snippet);
        }}
      />

      <SyncModal
        isOpen={activeModal === 'sync'}
        onClose={() => setActiveModal(null)}
        theme={theme}
        project={project}
        syncConfig={syncConfig}
        onUpdateSyncConfig={setSyncConfig}
        onImportPulledFiles={handleImportFiles}
      />

      <CompilerSettingsModal
        isOpen={activeModal === 'compiler'}
        onClose={() => setActiveModal(null)}
        theme={theme}
        settings={compilerSettings}
        onChange={setCompilerSettings}
        detectedTex={detectedTex}
        onRescanLocalTex={() => detectLocalCompilers(compilerSettings.customBinaryPath)}
      />

      <SettingsModal
        isOpen={activeModal === 'settings'}
        onClose={() => setActiveModal(null)}
        theme={theme}
        themeId={themeId}
        onChangeTheme={setThemeId}
        editorFontId={editorFontId}
        onChangeFont={setEditorFontId}
        editorFontSize={editorFontSize}
        onChangeFontSize={setEditorFontSize}
        directionMode={directionMode}
        onChangeDirectionMode={setDirectionMode}
        keyboardScript={keyboardScript}
      />

      {/* External Preview Fallback Modal (if browser blocks popup inside iframe) */}
      {activeModal === 'external-fallback' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="External PDF Preview"
          className="fixed inset-0 z-50 flex flex-col bg-black/70 p-4 sm:p-6"
        >
          <div
            className="flex-1 rounded-xl border overflow-hidden flex flex-col shadow-2xl"
            style={{
              backgroundColor: theme.ui.bg,
              borderColor: theme.ui.border,
              color: theme.ui.text,
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-2.5 border-b"
              style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.surface }}
            >
              <span className="text-xs font-semibold">
                External PDF Preview Window
              </span>
              <button
                type="button"
                aria-label="Close external preview"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded hover:opacity-75"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <PdfPreviewPane
                source={mainFile?.content || ''}
                compileResult={compileResult}
                isCompiling={isCompiling}
                theme={theme}
                onOpenExternal={() => {}}
                onRecompile={handleCompile}
                isExternalWindow
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
