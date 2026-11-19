import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Play,
  PanelLeft,
  FileCode2,
  FolderOutput,
  Save,
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
  ShortcutActionId,
  ShortcutMap,
  SyncConfig,
  ThemeId,
} from './types/latex';
import { mergeShortcuts } from './utils/shortcuts';
import { matchesShortcutEvent } from './utils/shortcuts';
import { EDITOR_THEMES } from './utils/themes';
import { EDITOR_FONTS } from './utils/editorFonts';
import {
  createInitialProject,
  createInitialProjects,
  migrateLegacyDefaultProject,
  ProjectTemplate,
} from './utils/defaultProjects';
import {
  DEFAULT_COMPILER_SETTINGS,
  inferPreferredCompilerMode,
  inferProjectCompilerMode,
  mergeCompilerSettings,
} from './utils/compilerArgs';
import {
  inferFileLanguage,
  isImageAssetFile,
  normalizeProjectFilePath,
  stripSharedRootFolder,
} from './utils/fileTree';
import {
  resolveCompileTargetFile,
  resolveDocumentDisplayTitle,
} from './utils/documentTitle';
import { markdownToLatex } from './utils/latexMarkdown';
import { LatexCodeEditor } from './components/LatexCodeEditor';
import { PdfPreviewPane } from './components/PdfPreviewPane';
import { LogDrawer, LogDrawerTab } from './components/LogDrawer';
import { SmartAiModal } from './components/SmartAiModal';
import { SyncModal } from './components/SyncModal';
import { CompilerSettingsModal } from './components/CompilerSettingsModal';
import { FileModal } from './components/FileModal';
import { SettingsModal } from './components/SettingsModal';
import { TeXcellentLogo } from './components/TeXcellentLogo';
import { FileTreeSidebar } from './components/FileTreeSidebar';

const STORAGE_PROJECT_KEY = 'texcellent_project_v1';
const STORAGE_PROJECTS_KEY = 'texcellent_projects_v1';
const STORAGE_ACTIVE_PROJECT_KEY = 'texcellent_active_project_v1';
const STORAGE_TABS_KEY = 'texcellent_open_tabs_v1';
const STORAGE_THEME_KEY = 'texcellent_theme_v1';
const STORAGE_FONT_KEY = 'texcellent_font_v1';
const STORAGE_FONT_SIZE_KEY = 'texcellent_font_size_v1';
const STORAGE_BIDI_KEY = 'texcellent_bidi_v1';
const STORAGE_COMPILER_KEY = 'texcellent_compiler_v1';
const STORAGE_COMPILER_MIGRATED_HALT_KEY = 'texcellent_compiler_halt_default_v2';
const STORAGE_SYNC_KEY = 'texcellent_sync_v1';
const STORAGE_SHORTCUTS_KEY = 'texcellent_shortcuts_v1';

const LEGACY_KEYS: Record<string, string> = {
  [STORAGE_PROJECT_KEY]: 'texmatch_project_v1',
  [STORAGE_THEME_KEY]: 'texmatch_theme_v1',
  [STORAGE_FONT_KEY]: 'texmatch_font_v1',
  [STORAGE_FONT_SIZE_KEY]: 'texmatch_font_size_v1',
  [STORAGE_COMPILER_KEY]: 'texmatch_compiler_v1',
  [STORAGE_SYNC_KEY]: 'texmatch_sync_v1',
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
    const raw =
      localStorage.getItem(key) ??
      (LEGACY_KEYS[key] ? localStorage.getItem(LEGACY_KEYS[key]) : null);
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

  const [projects, setProjects] = useState<LatexProject[]>(() => {
    const savedMulti = loadJson<LatexProject[] | null>(STORAGE_PROJECTS_KEY, null);
    if (Array.isArray(savedMulti) && savedMulti.length > 0) {
      return savedMulti.map((p) => migrateLegacyDefaultProject(p));
    }
    const legacySingle = loadJson<LatexProject | null>(STORAGE_PROJECT_KEY, null);
    const defaults = createInitialProjects();
    if (legacySingle && Array.isArray(legacySingle.files) && legacySingle.files.length > 0) {
      const migrated = migrateLegacyDefaultProject(legacySingle);
      const rest = defaults.filter((d) => d.id !== migrated.id && d.name !== migrated.name);
      return [migrated, ...rest];
    }
    return defaults;
  });

  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    const savedId = loadJson<string>(STORAGE_ACTIVE_PROJECT_KEY, '');
    return savedId || projects[0]?.id || 'proj-default';
  });

  const project =
    projects.find((p) => p.id === activeProjectId) || projects[0] || createInitialProject();

  const setProject = useCallback(
    (updater: LatexProject | ((prev: LatexProject) => LatexProject)) => {
      setProjects((prevList) => {
        const current =
          prevList.find((p) => p.id === activeProjectId) || prevList[0] || createInitialProject();
        const next = typeof updater === 'function' ? updater(current) : updater;
        const idx = prevList.findIndex((p) => p.id === current.id);
        if (idx === -1) return [...prevList, next];
        const copy = [...prevList];
        copy[idx] = next;
        return copy;
      });
    },
    [activeProjectId]
  );

  const [activeFileId, setActiveFileId] = useState<string>(
    () => project.mainFileId || project.files[0]?.id || 'main-tex'
  );
  const [openTabIds, setOpenTabIds] = useState<string[]>(() => {
    const saved = loadJson<string[]>(STORAGE_TABS_KEY, []);
    const valid = saved.filter((id) => project.files.some((f) => f.id === id));
    if (valid.length > 0) return valid;
    const initial = [project.mainFileId || project.files[0]?.id].filter(Boolean) as string[];
    return initial;
  });
  const [themeId, setThemeId] = useState<ThemeId>(
    () => loadJson<ThemeId>(STORAGE_THEME_KEY, 'github-light')
  );
  const [editorFontId, setEditorFontId] = useState<EditorFontId>(
    () => loadJson<EditorFontId>(STORAGE_FONT_KEY, 'jetbrains')
  );
  const [editorFontSize, setEditorFontSize] = useState<number>(
    () => loadJson<number>(STORAGE_FONT_SIZE_KEY, 14)
  );
  const [compilerSettings, setCompilerSettings] = useState<CompilerSettings>(() => {
    const merged = mergeCompilerSettings(
      loadJson<Partial<CompilerSettings>>(STORAGE_COMPILER_KEY, DEFAULT_COMPILER_SETTINGS)
    );
    try {
      if (!localStorage.getItem(STORAGE_COMPILER_MIGRATED_HALT_KEY)) {
        localStorage.setItem(STORAGE_COMPILER_MIGRATED_HALT_KEY, '1');
        return { ...merged, haltOnError: false };
      }
    } catch {
      // ignore storage failure
    }
    return merged;
  });
  const [detectedTex, setDetectedTex] = useState<DetectedTexInstallation | null>(null);
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(
    () => loadJson<SyncConfig>(STORAGE_SYNC_KEY, DEFAULT_SYNC_CONFIG)
  );

  const [directionMode, setDirectionMode] = useState<DirectionMode>(
    () => loadJson<DirectionMode>(STORAGE_BIDI_KEY, 'auto')
  );
  const [shortcuts, setShortcuts] = useState<ShortcutMap>(() =>
    mergeShortcuts(loadJson<Partial<Record<string, unknown>> | null>(STORAGE_SHORTCUTS_KEY, null))
  );
  const [previewMode, setPreviewMode] = useState<PreviewMode>('beside');
  const [mobilePane, setMobilePane] = useState<'editor' | 'preview'>('editor');
  const [showSidebar, setShowSidebar] = useState<boolean>(true);
  const [showLog, setShowLog] = useState<boolean>(false);
  const [logTab, setLogTab] = useState<LogDrawerTab>('bugs');
  const [splitRatio, setSplitRatio] = useState<number>(50);

  const [cursorInfo, setCursorInfo] = useState<{
    line: number;
    col: number;
    detectedDir: 'ltr' | 'rtl';
  }>({ line: 1, col: 1, detectedDir: 'ltr' });
  const [keyboardScript, setKeyboardScript] = useState<'ltr' | 'rtl'>('ltr');

  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [compileRequestTick, setCompileRequestTick] = useState<number>(0);

  const [activeModal, setActiveModal] = useState<
    null | 'file' | 'smart' | 'sync' | 'compiler' | 'settings' | 'external-fallback'
  >(null);
  const [dirtyFileIds, setDirtyFileIds] = useState<Set<string>>(() => new Set());
  const [pendingCloseFileId, setPendingCloseFileId] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string>('');

  const editorActionsRef = useRef<{
    insertAtCursor: (snippet: string) => void;
    jumpToLine?: (lineNumber: number) => void;
  } | null>(null);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const isResizingRef = useRef(false);
  const sidebarFolderInputRef = useRef<HTMLInputElement | null>(null);
  const lastTargetFileIdRef = useRef<string | undefined>(undefined);
  const saveNoticeTimerRef = useRef<number | null>(null);

  const theme = EDITOR_THEMES[themeId] || EDITOR_THEMES['github-light'];
  const editorFont = EDITOR_FONTS[editorFontId] || EDITOR_FONTS.jetbrains;
  const activeFile =
    project.files.find((f) => f.id === activeFileId) || project.files[0];
  const mainFile =
    project.files.find((f) => f.id === project.mainFileId) || project.files[0];
  const compileTargetFile = resolveCompileTargetFile(activeFile, mainFile, project.files);
  const documentDisplayTitle = resolveDocumentDisplayTitle(activeFile, mainFile, project.name);

  const openFileTab = useCallback((fileId: string) => {
    setActiveFileId(fileId);
    setOpenTabIds((prev) => (prev.includes(fileId) ? prev : [...prev, fileId]));
  }, []);

  const forceCloseFileTab = useCallback(
    (fileId: string) => {
      setOpenTabIds((prev) => {
        if (prev.length <= 1) return prev;
        const idx = prev.indexOf(fileId);
        const next = prev.filter((id) => id !== fileId);
        if (activeFileId === fileId && next.length > 0) {
          const replacement = next[Math.max(0, idx - 1)] || next[0];
          setActiveFileId(replacement);
        }
        return next;
      });
      setDirtyFileIds((prev) => {
        if (!prev.has(fileId)) return prev;
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
    },
    [activeFileId]
  );

  const closeFileTab = useCallback(
    (fileId: string) => {
      if (openTabIds.length <= 1) return;
      if (dirtyFileIds.has(fileId)) {
        setPendingCloseFileId(fileId);
        return;
      }
      forceCloseFileTab(fileId);
    },
    [openTabIds.length, dirtyFileIds, forceCloseFileTab]
  );

  // Persist workspace state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(projects));
      localStorage.setItem(STORAGE_ACTIVE_PROJECT_KEY, JSON.stringify(activeProjectId));
      localStorage.setItem(STORAGE_PROJECT_KEY, JSON.stringify(project));
    } catch {
      // ignore storage quota errors
    }
  }, [projects, activeProjectId, project]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TABS_KEY, JSON.stringify(openTabIds));
    } catch {
      // ignore
    }
  }, [openTabIds]);

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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SHORTCUTS_KEY, JSON.stringify(shortcuts));
    } catch {
      // ignore
    }
  }, [shortcuts]);

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

  const handleCompile = useCallback(async (overrideMode?: CompilerMode) => {
    const baseMode = overrideMode || compilerSettings.compilerMode;
    const effectiveMode = overrideMode
      ? overrideMode
      : inferProjectCompilerMode(project.files, baseMode);
    if (!overrideMode && effectiveMode !== compilerSettings.compilerMode) {
      setCompilerSettings((prev) => ({ ...prev, compilerMode: effectiveMode }));
    }
    setIsCompiling(true);
    try {
      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: documentDisplayTitle,
          mainFileName: compileTargetFile?.name || mainFile?.name || 'main.tex',
          files: project.files,
          mode: effectiveMode,
          customBinaryPath: compilerSettings.customBinaryPath,
          remoteEndpointUrl: compilerSettings.remoteEndpointUrl,
          shellEscape: compilerSettings.shellEscape,
          synctex: compilerSettings.synctex,
          interactionMode: compilerSettings.interactionMode,
          compilePasses: compilerSettings.compilePasses,
          bibliographyTool: compilerSettings.bibliographyTool,
          outputFormat: compilerSettings.outputFormat,
          fileLineError: compilerSettings.fileLineError,
          haltOnError: compilerSettings.haltOnError,
          extraArgs: compilerSettings.extraArgs,
        }),
      });
      const data = (await res.json()) as CompileResult;
      setCompileResult(data);
      const hasBugDiagnostics = (data.diagnostics || []).some((d) => d.level === 'error');
      if (!data.success || hasBugDiagnostics) {
        setLogTab('bugs');
        setShowLog(true);
      }
    } catch (err) {
      console.error('Compile failed:', err);
    } finally {
      setIsCompiling(false);
    }
  }, [project, compileTargetFile, mainFile, documentDisplayTitle, compilerSettings]);

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
      lastTargetFileIdRef.current = compileTargetFile?.id;
      detectLocalCompilers(compilerSettings.customBinaryPath);
      const initialInferred = inferProjectCompilerMode(
        project.files,
        compilerSettings.compilerMode
      );
      if (initialInferred !== compilerSettings.compilerMode) {
        setCompilerSettings((prev) => ({ ...prev, compilerMode: initialInferred }));
      }
      handleCompile(initialInferred);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Post-state-commit compilation trigger (eliminates stale closures after project/file/folder switches)
  useEffect(() => {
    if (compileRequestTick > 0 && !isExternalPreviewWindow) {
      lastTargetFileIdRef.current = compileTargetFile?.id;
      handleCompile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compileRequestTick]);

  // Auto-recompile when switching to a different standalone .tex document
  useEffect(() => {
    if (isExternalPreviewWindow) return;
    const nextId = compileTargetFile?.id;
    if (nextId && lastTargetFileIdRef.current && nextId !== lastTargetFileIdRef.current) {
      lastTargetFileIdRef.current = nextId;
      const inferred = inferPreferredCompilerMode(
        compileTargetFile.content,
        compilerSettings.compilerMode
      );
      if (inferred !== compilerSettings.compilerMode) {
        setCompilerSettings((prev) => ({ ...prev, compilerMode: inferred }));
      }
      setCompileRequestTick((t) => t + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compileTargetFile?.id]);

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

  // Warn user before closing or reloading when files have unsaved changes
  useEffect(() => {
    if (isExternalPreviewWindow || dirtyFileIds.size === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isExternalPreviewWindow, dirtyFileIds.size]);

  const showSaveFeedback = useCallback((msg: string) => {
    setSaveNotice(msg);
    if (saveNoticeTimerRef.current) {
      window.clearTimeout(saveNoticeTimerRef.current);
    }
    saveNoticeTimerRef.current = window.setTimeout(() => {
      setSaveNotice('');
    }, 2600);
  }, []);

  const handleSaveFile = useCallback(
    async (targetFile?: ProjectFile): Promise<boolean> => {
      const fileToSave = targetFile || activeFile;
      if (!fileToSave) return false;

      let blob: Blob;
      if (fileToSave.language === 'asset' && fileToSave.binaryBase64) {
        const bin = atob(fileToSave.binaryBase64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        blob = new Blob([arr], { type: fileToSave.mimeType || 'application/octet-stream' });
      } else {
        blob = new Blob([fileToSave.content], { type: 'text/plain;charset=utf-8' });
      }

      const fileNameOnly = fileToSave.name.split('/').pop() || fileToSave.name;
      const triggerDownload = () => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileNameOnly;
        a.click();
        URL.revokeObjectURL(url);
      };

      const picker = (
        window as unknown as {
          showSaveFilePicker?: (opts: { suggestedName?: string }) => Promise<{
            createWritable: () => Promise<{
              write: (data: Blob) => Promise<void>;
              close: () => Promise<void>;
            }>;
          }>;
        }
      ).showSaveFilePicker;

      const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
      const isAutomatedOrEmbedded =
        (typeof navigator !== 'undefined' && (Boolean(navigator.webdriver) || /HeadlessChrome/i.test(ua))) ||
        (typeof window !== 'undefined' && window.self !== window.top);

      const canUsePicker = typeof picker === 'function' && !isAutomatedOrEmbedded;

      if (canUsePicker) {
        try {
          const handle = await picker({ suggestedName: fileNameOnly });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return false;
          }
          triggerDownload();
        }
      } else {
        triggerDownload();
      }

      setDirtyFileIds((prev) => {
        if (!prev.has(fileToSave.id)) return prev;
        const next = new Set(prev);
        next.delete(fileToSave.id);
        return next;
      });
      showSaveFeedback(`Saved ${fileNameOnly}`);
      return true;
    },
    [activeFile, showSaveFeedback]
  );

  const triggerWorkspaceShortcut = useCallback(
    (
      action: Extract<
        ShortcutActionId,
        'compile' | 'saveFile' | 'togglePreview' | 'toggleSidebar' | 'toggleLog' | 'openFiles' | 'openSettings'
      >
    ) => {
      switch (action) {
        case 'compile':
          handleCompile();
          break;
        case 'saveFile':
          handleSaveFile();
          break;
        case 'togglePreview':
          setPreviewMode((prev) => (prev === 'beside' ? 'editor-only' : 'beside'));
          break;
        case 'toggleSidebar':
          setShowSidebar((v) => !v);
          break;
        case 'toggleLog':
          setShowLog((v) => !v);
          break;
        case 'openFiles':
          setActiveModal((prev) => (prev === 'file' ? null : 'file'));
          break;
        case 'openSettings':
          setActiveModal((prev) => (prev === 'settings' ? null : 'settings'));
          break;
      }
    },
    [handleCompile, handleSaveFile]
  );

  // Global keyboard shortcut listener (skips while recording new shortcuts in Settings)
  useEffect(() => {
    if (isExternalPreviewWindow) return;
    const isMac =
      typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || '');

    const onKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('[data-shortcut-recording="true"]')) return;

      const target = e.target as HTMLElement | null;
      const inCodeMirror = Boolean(target?.closest('.cm-editor'));
      if (inCodeMirror) return;

      const actions: Array<
        Extract<
          ShortcutActionId,
          'compile' | 'saveFile' | 'togglePreview' | 'toggleSidebar' | 'toggleLog' | 'openFiles' | 'openSettings'
        >
      > = ['compile', 'saveFile', 'togglePreview', 'toggleSidebar', 'toggleLog', 'openFiles', 'openSettings'];

      for (const actionId of actions) {
        if (matchesShortcutEvent(e, shortcuts[actionId], isMac)) {
          e.preventDefault();
          triggerWorkspaceShortcut(actionId);
          return;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isExternalPreviewWindow, shortcuts, triggerWorkspaceShortcut]);

  useEffect(() => {
    if (!pendingCloseFileId) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setPendingCloseFileId(null);
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [pendingCloseFileId]);

  const handleFileContentChange = (nextContent: string) => {
    if (!activeFile || nextContent === activeFile.content) return;
    const now = new Date().toISOString();
    setDirtyFileIds((prev) => {
      if (prev.has(activeFile.id)) return prev;
      const next = new Set(prev);
      next.add(activeFile.id);
      return next;
    });
    setProject((prev) => ({
      ...prev,
      updatedAt: now,
      files: prev.files.map((f) =>
        f.id === activeFile.id ? { ...f, content: nextContent, updatedAt: now } : f
      ),
    }));
  };

  const handleSelectProjectFile = useCallback(
    (targetProjectId: string, fileId: string) => {
      const targetProj = projects.find((p) => p.id === targetProjectId);
      if (!targetProj) return;
      if (targetProjectId !== activeProjectId) {
        setActiveProjectId(targetProjectId);
        setActiveFileId(fileId);
        const mainOrFirst = targetProj.mainFileId || targetProj.files[0]?.id;
        setOpenTabIds(
          mainOrFirst && mainOrFirst !== fileId ? [mainOrFirst, fileId] : [fileId]
        );
        const preferredMode = inferProjectCompilerMode(
          targetProj.files,
          compilerSettings.compilerMode
        );
        if (preferredMode !== compilerSettings.compilerMode) {
          setCompilerSettings((prev) => ({ ...prev, compilerMode: preferredMode }));
        }
        setCompileRequestTick((t) => t + 1);
      } else {
        openFileTab(fileId);
      }
    },
    [projects, activeProjectId, openFileTab, compilerSettings.compilerMode]
  );

  const handleCreateFile = useCallback(
    (rawPath: string, content?: string, targetProjectId?: string) => {
      const clean = normalizeProjectFilePath(rawPath);
      const finalName = /\.(tex|bib|sty|cls|png|jpe?g|gif|webp|svg|pdf|eps)$/i.test(clean)
        ? clean
        : `${clean}.tex`;
      const lang = inferFileLanguage(finalName);
      const newFile: ProjectFile = {
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: finalName,
        content:
          content ??
          (finalName.endsWith('.bib')
            ? `@article{key2026,\n  author = {Author},\n  title = {Title},\n  year = {2026}\n}\n`
            : lang === 'asset'
              ? ''
              : `% ${finalName}\n\\section{New Section}\n`),
        language: lang,
        updatedAt: new Date().toISOString(),
      };
      const projId = targetProjectId || project.id;
      setProjects((prevList) =>
        prevList.map((p) =>
          p.id === projId
            ? { ...p, files: [...p.files, newFile], updatedAt: new Date().toISOString() }
            : p
        )
      );
      if (projId !== activeProjectId) {
        setActiveProjectId(projId);
        setOpenTabIds([newFile.id]);
        setCompileRequestTick((t) => t + 1);
      } else {
        setOpenTabIds((prev) => [...prev, newFile.id]);
      }
      setActiveFileId(newFile.id);
    },
    [project.id, activeProjectId]
  );

  const handleUploadAssetsToProject = useCallback(
    async (targetProjectId: string, fileList: FileList) => {
      const items = Array.from(fileList);
      if (!items.length) return;

      const toBase64 = (buf: ArrayBuffer): string => {
        const bytes = new Uint8Array(buf);
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        return btoa(binary);
      };

      const added: ProjectFile[] = [];
      for (let i = 0; i < items.length; i++) {
        const f = items[i];
        const cleanName = normalizeProjectFilePath(f.name);
        const lang = inferFileLanguage(cleanName);
        if (lang === 'asset') {
          const buf = await f.arrayBuffer();
          added.push({
            id: `asset-${Date.now()}-${i}`,
            name: cleanName,
            content: '',
            language: 'asset',
            binaryBase64: toBase64(buf),
            mimeType: f.type || 'image/png',
            updatedAt: new Date().toISOString(),
          });
        } else {
          const text = await f.text();
          added.push({
            id: `file-${Date.now()}-${i}`,
            name: cleanName,
            content: text,
            language: lang,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      if (!added.length) return;
      setProjects((prevList) =>
        prevList.map((p) => {
          if (p.id !== targetProjectId) return p;
          const merged = [...p.files];
          for (const nextFile of added) {
            const idx = merged.findIndex((existing) => existing.name === nextFile.name);
            if (idx !== -1) merged[idx] = { ...merged[idx], ...nextFile, id: merged[idx].id };
            else merged.push(nextFile);
          }
          return { ...p, files: merged, updatedAt: new Date().toISOString() };
        })
      );
      if (targetProjectId !== activeProjectId) {
        setActiveProjectId(targetProjectId);
        setOpenTabIds([added[0].id]);
      } else {
        setOpenTabIds((prev) =>
          prev.includes(added[0].id) ? prev : [...prev, added[0].id]
        );
      }
      setActiveFileId(added[0].id);
    },
    [activeProjectId]
  );

  const handleDeleteFile = (fileId: string, targetProjectId?: string) => {
    const projId = targetProjectId || project.id;
    const targetProj = projects.find((p) => p.id === projId);
    if (!targetProj || targetProj.files.length <= 1 || fileId === targetProj.mainFileId) return;
    const remaining = targetProj.files.filter((f) => f.id !== fileId);
    setProjects((prevList) =>
      prevList.map((p) =>
        p.id === projId
          ? { ...p, files: remaining, updatedAt: new Date().toISOString() }
          : p
      )
    );
    if (projId === activeProjectId) {
      setOpenTabIds((prev) => {
        const filtered = prev.filter((id) => id !== fileId);
        return filtered.length > 0 ? filtered : [remaining[0].id];
      });
      if (activeFileId === fileId) {
        setActiveFileId(remaining[0].id);
      }
    }
  };

  const handleDeleteProject = (targetProjectId: string) => {
    if (projects.length <= 1) return;
    const remaining = projects.filter((p) => p.id !== targetProjectId);
    setProjects(remaining);
    if (activeProjectId === targetProjectId && remaining[0]) {
      const nextProj = remaining[0];
      setActiveProjectId(nextProj.id);
      const nextMain = nextProj.mainFileId || nextProj.files[0]?.id;
      setActiveFileId(nextMain);
      setOpenTabIds(nextMain ? [nextMain] : []);
      setCompileRequestTick((t) => t + 1);
    }
  };

  const handleSelectTemplate = (tpl: ProjectTemplate) => {
    const nextProject: LatexProject = {
      id: `proj-${Date.now()}`,
      ...tpl.project,
      updatedAt: new Date().toISOString(),
    };
    setProjects((prev) => [...prev, nextProject]);
    setActiveProjectId(nextProject.id);
    setActiveFileId(nextProject.mainFileId);
    setOpenTabIds([nextProject.mainFileId]);
    setCompilerSettings((prev) => ({
      ...prev,
      compilerMode: tpl.project.compilerMode,
    }));
    setCompileRequestTick((t) => t + 1);
  };

  const handleImportFiles = (incoming: ProjectFile[], folderProjectName?: string) => {
    if (!incoming.length) return;
    let firstSelectedId = incoming[0].id;
    const openIds: string[] = [];

    const mainCandidate =
      incoming.find((f) => /(^|\/)main\.tex$/i.test(f.name)) ||
      incoming.find(
        (f) =>
          f.language === 'latex' &&
          /\\documentclass(?:\[[^\]]*\])?\s*\{/i.test(f.content)
      );

    if (folderProjectName) {
      const primary = mainCandidate || incoming.find((f) => f.language === 'latex') || incoming[0];
      const preferredMode = inferPreferredCompilerMode(
        primary.content,
        compilerSettings.compilerMode
      );
      const created: LatexProject = {
        id: `proj-import-${Date.now()}`,
        name: folderProjectName,
        mainFileId: primary.id,
        compilerMode: preferredMode,
        files: incoming.map((f) => ({ ...f, name: normalizeProjectFilePath(f.name) })),
        updatedAt: new Date().toISOString(),
      };
      setProjects((prev) => [...prev, created]);
      setActiveProjectId(created.id);
      setActiveFileId(primary.id);
      setOpenTabIds([primary.id]);
      if (preferredMode !== compilerSettings.compilerMode) {
        setCompilerSettings((prev) => ({ ...prev, compilerMode: preferredMode }));
      }
      setCompileRequestTick((t) => t + 1);
      return;
    }

    setProject((prev) => {
      const merged = [...prev.files];
      let nextMainId = prev.mainFileId;
      for (const file of incoming) {
        const cleanName = normalizeProjectFilePath(file.name);
        const idx = merged.findIndex((f) => f.name === cleanName);
        if (idx !== -1) {
          merged[idx] = {
            ...merged[idx],
            content: file.content,
            binaryBase64: file.binaryBase64,
            mimeType: file.mimeType,
            language: file.language,
            updatedAt: file.updatedAt,
          };
          openIds.push(merged[idx].id);
          if (file.id === incoming[0].id) firstSelectedId = merged[idx].id;
          if (mainCandidate && file.id === mainCandidate.id) nextMainId = merged[idx].id;
        } else {
          const added = { ...file, name: cleanName };
          merged.push(added);
          openIds.push(added.id);
          if (mainCandidate && file.id === mainCandidate.id) nextMainId = added.id;
        }
      }
      return {
        ...prev,
        mainFileId: nextMainId,
        files: merged,
        updatedAt: new Date().toISOString(),
      };
    });

    const targetId = mainCandidate ? mainCandidate.id : firstSelectedId;
    setActiveFileId(targetId);
    setOpenTabIds((prev) => {
      const next = [...prev];
      for (const id of openIds.slice(0, 8)) {
        if (!next.includes(id)) next.push(id);
      }
      return next;
    });

    const targetFile = mainCandidate || incoming[0];
    if (targetFile) {
      setCompilerSettings((prev) => ({
        ...prev,
        compilerMode: inferPreferredCompilerMode(targetFile.content, prev.compilerMode),
      }));
    }
    setCompileRequestTick((t) => t + 1);
  };

  const handleOpenFolderSelection = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const rawFiles = Array.from(fileList).filter((f) => {
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      return /\.(tex|bib|sty|cls|bst|clo|def|cfg|ltx|md|png|jpe?g|gif|webp|svg|pdf|eps)$/i.test(
        rel
      );
    });
    if (rawFiles.length === 0) return;

    const toBase64 = (buf: ArrayBuffer): string => {
      const bytes = new Uint8Array(buf);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      return btoa(binary);
    };

    const rawPaths = rawFiles.map(
      (f) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name
    );
    const folderTitle =
      rawPaths[0].includes('/') ? rawPaths[0].split('/')[0] : 'Opened Folder';
    const strippedPaths = stripSharedRootFolder(rawPaths);

    const nextFiles: ProjectFile[] = [];
    for (let i = 0; i < rawFiles.length; i++) {
      const f = rawFiles[i];
      const relPath = strippedPaths[i];
      if (/\.md$/i.test(relPath)) {
        const text = await f.text();
        const texName = relPath.replace(/\.md$/i, '.tex');
        nextFiles.push({
          id: `dir-${Date.now()}-${i}`,
          name: texName,
          content: markdownToLatex(text, {
            includePreamble: true,
            title: texName.replace(/\.tex$/i, ''),
          }),
          language: 'latex',
          updatedAt: new Date().toISOString(),
        });
      } else if (/\.(png|jpe?g|gif|webp|svg|pdf|eps)$/i.test(relPath)) {
        const buf = await f.arrayBuffer();
        nextFiles.push({
          id: `dir-${Date.now()}-${i}`,
          name: relPath,
          content: '',
          language: 'asset',
          binaryBase64: toBase64(buf),
          mimeType: f.type || 'image/png',
          updatedAt: new Date().toISOString(),
        });
      } else {
        const text = await f.text();
        nextFiles.push({
          id: `dir-${Date.now()}-${i}`,
          name: relPath,
          content: text,
          language: inferFileLanguage(relPath),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    if (nextFiles.length === 0) return;
    const primaryFile =
      nextFiles.find((f) => f.name.toLowerCase() === 'main.tex') ||
      nextFiles.find(
        (f) =>
          f.name.toLowerCase().endsWith('.tex') &&
          /\\documentclass(?:\[[^\]]*\])?\s*\{/i.test(f.content)
      ) ||
      nextFiles.find((f) => f.name.toLowerCase().endsWith('.tex')) ||
      nextFiles[0];

    const preferredMode = inferPreferredCompilerMode(
      primaryFile.content,
      compilerSettings.compilerMode
    );

    const nextProject: LatexProject = {
      id: `proj-folder-${Date.now()}`,
      name: folderTitle || 'Opened Folder',
      mainFileId: primaryFile.id,
      compilerMode: preferredMode,
      files: nextFiles,
      updatedAt: new Date().toISOString(),
    };
    setProjects((prev) => [...prev, nextProject]);
    setActiveProjectId(nextProject.id);
    setActiveFileId(primaryFile.id);
    setOpenTabIds([primaryFile.id]);
    if (preferredMode !== compilerSettings.compilerMode) {
      setCompilerSettings((prev) => ({ ...prev, compilerMode: preferredMode }));
    }
    setCompileRequestTick((t) => t + 1);
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
    setProjects((prev) => [...prev, nextProject]);
    setActiveProjectId(nextProject.id);
    setActiveFileId(mainId);
    setOpenTabIds([mainId]);
    setCompileRequestTick((t) => t + 1);
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
          compileResult={compileResult}
          isCompiling={isCompiling}
          theme={theme}
          onOpenExternal={() => {}}
          onRecompile={() => handleCompile()}
          onOpenLog={() => setShowLog(true)}
          isExternalWindow
        />
      </div>
    );
  }

  const openTabFiles = openTabIds
    .map((id) => project.files.find((f) => f.id === id))
    .filter((f): f is ProjectFile => Boolean(f));

  const backendConnectionLabel = detectedTex?.hasNative
    ? `Local ${detectedTex.detectedFamily || 'TeX'}`
    : compilerSettings.remoteEndpointUrl?.trim()
      ? 'Remote TeX'
      : 'Built-in';

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden"
      style={{
        backgroundColor: theme.ui.bg,
        color: theme.ui.text,
      }}
    >
      {/* Hidden folder picker for sidebar Open Folder button */}
      <input
        ref={sidebarFolderInputRef}
        type="file"
        multiple
        {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
        className="hidden"
        onChange={(e) => handleOpenFolderSelection(e.target.files)}
      />

      {/* Top Bar: Left = Navigation Tabs · Center = {TeXcellent} Logo · Right = Compile CTA */}
      <header
        className="flex md:grid md:grid-cols-3 items-center justify-between gap-4 px-5 py-2.5 border-b shrink-0"
        style={{
          backgroundColor: theme.ui.bg,
          borderColor: theme.ui.border,
        }}
      >
        <nav className="hidden md:flex items-center gap-5 text-sm font-semibold justify-self-start">
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
          <TeXcellentLogo isDark={theme.isDark} height={42} />
        </a>

        <div className="flex items-center justify-self-end shrink-0">
          <button
            type="button"
            onClick={() => handleCompile()}
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

          <span
            dir="auto"
            className="hidden sm:inline text-xs font-semibold truncate max-w-[260px]"
            title={documentDisplayTitle}
          >
            {documentDisplayTitle}
          </span>

          {/* Quick mobile action triggers */}
          <div className="flex md:hidden items-center gap-1 font-semibold">
            <button
              type="button"
              onClick={() => setActiveModal('file')}
              className="px-2 py-1 text-xs font-semibold rounded border whitespace-nowrap"
              style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.bg }}
            >
              File
            </button>
            <button
              type="button"
              onClick={() => setActiveModal('smart')}
              className="px-2 py-1 text-xs font-semibold rounded border whitespace-nowrap"
              style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.bg }}
            >
              Smart
            </button>
            <button
              type="button"
              onClick={() => setActiveModal('sync')}
              className="px-2 py-1 text-xs font-semibold rounded border whitespace-nowrap"
              style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.bg }}
            >
              Sync
            </button>
            <button
              type="button"
              onClick={() => setActiveModal('compiler')}
              className="px-2 py-1 text-xs font-semibold rounded border whitespace-nowrap"
              style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.bg }}
            >
              Compiler
            </button>
            <button
              type="button"
              onClick={() => setActiveModal('settings')}
              className="px-2 py-1 text-xs font-semibold rounded border whitespace-nowrap"
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
              className="px-2.5 py-1 text-xs font-semibold rounded border outline-none"
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

          {/* Local Backend Status Trigger (opens Compiler settings) */}
          <button
            type="button"
            onClick={() => setActiveModal('compiler')}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border whitespace-nowrap"
            style={{
              backgroundColor: theme.ui.bg,
              borderColor: theme.ui.border,
              color: detectedTex?.hasNative ? '#16a34a' : theme.ui.textMuted,
            }}
            title="Check local TeX Live / MiKTeX backend connection & compiler flags"
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: detectedTex?.hasNative ? '#16a34a' : theme.ui.accent }}
            />
            {backendConnectionLabel}
          </button>

          {/* Preview Layout Switch (Desktop) */}
          <div
            className="hidden md:flex items-center p-0.5 rounded border"
            style={{ backgroundColor: theme.ui.surfaceAlt, borderColor: theme.ui.border }}
          >
            <button
              type="button"
              onClick={() => setPreviewMode('beside')}
              className="px-2.5 py-0.5 text-xs font-semibold rounded whitespace-nowrap"
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
              className="px-2.5 py-0.5 text-xs font-semibold rounded whitespace-nowrap"
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
              className="px-2 py-0.5 text-xs font-semibold rounded"
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
              className="px-2 py-0.5 text-xs font-semibold rounded"
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
        {/* Project Files Tree Sidebar */}
        {showSidebar && (
          <FileTreeSidebar
            theme={theme}
            projects={projects}
            activeProjectId={project.id}
            activeFileId={activeFile?.id || ''}
            dirtyFileIds={dirtyFileIds}
            onSelectProjectFile={handleSelectProjectFile}
            onSetMainFile={(projectId, fileId) =>
              setProjects((prevList) =>
                prevList.map((p) =>
                  p.id === projectId
                    ? { ...p, mainFileId: fileId, updatedAt: new Date().toISOString() }
                    : p
                )
              )
            }
            onAddFile={(projectId, filePath) => handleCreateFile(filePath, undefined, projectId)}
            onUploadAssets={handleUploadAssetsToProject}
            onDeleteFile={(projectId, fileId) => handleDeleteFile(fileId, projectId)}
            onCreateProject={handleNewBlankProject}
            onDeleteProject={handleDeleteProject}
            onOpenFolderClick={() => sidebarFolderInputRef.current?.click()}
          />
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
            {/* Open Files Multi-Tab Bar */}
            {openTabFiles.length > 0 && (
              <div
                role="tablist"
                aria-label="Open editor tabs"
                className="flex items-center border-b overflow-x-auto shrink-0"
                style={{
                  backgroundColor: theme.ui.surface,
                  borderColor: theme.ui.border,
                }}
              >
                {openTabFiles.map((tabFile) => {
                  const isTabActive = tabFile.id === activeFile?.id;
                  const isTabDirty = dirtyFileIds.has(tabFile.id);
                  return (
                    <div
                      key={tabFile.id}
                      role="presentation"
                      onMouseDown={(e) => {
                        if (e.button === 1 && openTabFiles.length > 1) {
                          e.preventDefault();
                          closeFileTab(tabFile.id);
                        }
                      }}
                      className="group flex items-center shrink-0"
                      style={{
                        backgroundColor: isTabActive ? theme.ui.bg : 'transparent',
                        borderRightWidth: '1px',
                        borderRightStyle: 'solid',
                        borderRightColor: theme.ui.border,
                        borderBottomWidth: '2px',
                        borderBottomStyle: 'solid',
                        borderBottomColor: isTabActive ? theme.ui.accent : 'transparent',
                      }}
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={isTabActive}
                        onClick={() => openFileTab(tabFile.id)}
                        title={isTabDirty ? `${tabFile.name} (unsaved)` : tabFile.name}
                        className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 text-xs font-mono whitespace-nowrap"
                        style={{
                          color: isTabActive ? theme.ui.text : theme.ui.textMuted,
                          fontWeight: isTabActive ? 600 : 500,
                        }}
                      >
                        <FileCode2 className="w-3 h-3 shrink-0 opacity-75" />
                        <span>{tabFile.name}</span>
                        {isTabDirty && (
                          <span
                            aria-label={`${tabFile.name} unsaved`}
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: theme.ui.accent }}
                          />
                        )}
                      </button>
                      {openTabFiles.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Close tab ${tabFile.name}`}
                          onClick={() => closeFileTab(tabFile.id)}
                          className="pr-2 pl-0.5 py-1 opacity-60 hover:opacity-100"
                          style={{ color: theme.ui.textMuted }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-hidden">
              {activeFile && activeFile.language === 'asset' ? (
                <div
                  className="h-full w-full flex flex-col items-center justify-center p-6 overflow-auto gap-4"
                  style={{ backgroundColor: theme.editor.bg, color: theme.ui.text }}
                >
                  {activeFile.binaryBase64 && isImageAssetFile(activeFile.name) ? (
                    <img
                      src={`data:${activeFile.mimeType || 'image/png'};base64,${activeFile.binaryBase64}`}
                      alt={activeFile.name}
                      className="max-h-[60%] max-w-full rounded border object-contain bg-white p-2 shadow-sm"
                      style={{ borderColor: theme.ui.border }}
                    />
                  ) : (
                    <div
                      className="px-4 py-3 rounded-lg border text-xs font-mono"
                      style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.surface }}
                    >
                      Binary Asset: {activeFile.name}
                    </div>
                  )}
                  <div className="text-center space-y-2 max-w-md">
                    <div className="text-xs font-mono font-semibold">{activeFile.name}</div>
                    <div
                      className="px-3 py-1.5 rounded border text-xs font-mono select-all"
                      style={{
                        borderColor: theme.ui.border,
                        backgroundColor: theme.ui.surface,
                        color: theme.ui.textMuted,
                      }}
                    >
                      {`\\includegraphics[width=0.8\\textwidth]{${activeFile.name}}`}
                    </div>
                  </div>
                </div>
              ) : (
                activeFile && (
                  <LatexCodeEditor
                    value={activeFile.content}
                    onChange={handleFileContentChange}
                    theme={theme}
                    editorFont={editorFont}
                    editorFontSize={editorFontSize}
                    directionMode={directionMode}
                    files={project.files}
                    shortcuts={shortcuts}
                    onTriggerWorkspaceShortcut={triggerWorkspaceShortcut}
                    onCursorInfo={setCursorInfo}
                    onScriptDetected={setKeyboardScript}
                    editorRefOut={editorActionsRef}
                  />
                )
              )}
            </div>

            {/* Collapsible Compiler Log & Bugs Drawer */}
            {showLog && compileResult && (
              <LogDrawer
                compileResult={compileResult}
                activeTab={logTab}
                onChangeTab={setLogTab}
                onClose={() => setShowLog(false)}
                onJumpToLine={(line, fileName) => {
                  if (fileName) {
                    const target = project.files.find(
                      (f) => f.name === fileName || f.name.endsWith(`/${fileName}`)
                    );
                    if (target && target.id !== activeFile?.id) {
                      openFileTab(target.id);
                    }
                  }
                  setTimeout(() => {
                    editorActionsRef.current?.jumpToLine?.(line);
                  }, 30);
                }}
                onSwitchToXelatex={() => {
                  setCompilerSettings((prev) => ({ ...prev, compilerMode: 'xelatex' }));
                  handleCompile('xelatex');
                }}
                theme={theme}
              />
            )}

            {/* Quiet Editor Footer */}
            <div
              className="flex items-center justify-between px-3 py-1.5 border-t text-[11px] shrink-0 gap-2"
              style={{
                backgroundColor: theme.ui.surface,
                borderColor: theme.ui.border,
                color: theme.ui.textMuted,
              }}
            >
              <div className="flex items-center gap-3 tabular-nums min-w-0 truncate">
                <span>
                  Ln {cursorInfo.line}, Col {cursorInfo.col}
                </span>
                <span aria-hidden="true">·</span>
                <span>Line Dir: {cursorInfo.detectedDir.toUpperCase()}</span>
                <span aria-hidden="true" className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">Input Script: {keyboardScript.toUpperCase()}</span>
                {saveNotice && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold" style={{ color: theme.ui.accent }}>
                      {saveNotice}
                    </span>
                  </>
                )}
              </div>

              {(() => {
                const errCount = (compileResult?.diagnostics || []).filter(
                  (d) => d.level === 'error'
                ).length;
                const warnCount = (compileResult?.diagnostics || []).filter(
                  (d) => d.level === 'warning'
                ).length;
                const outputCount = compileResult?.generatedFiles?.length || 0;
                const activeIsDirty = activeFile ? dirtyFileIds.has(activeFile.id) : false;
                return (
                  <div className="flex items-center gap-3 shrink-0">
                    {activeIsDirty && (
                      <button
                        type="button"
                        onClick={() => handleSaveFile()}
                        className="inline-flex items-center gap-1 font-semibold hover:underline"
                        style={{ color: theme.ui.accent }}
                        title="Save active file to disk"
                      >
                        <Save className="w-3 h-3" />
                        <span>Save</span>
                      </button>
                    )}
                    {(errCount > 0 || warnCount > 0) && (
                      <button
                        type="button"
                        onClick={() => {
                          setLogTab('bugs');
                          setShowLog(true);
                        }}
                        className="inline-flex items-center gap-1.5 font-semibold hover:underline tabular-nums"
                        style={{ color: errCount > 0 ? '#dc2626' : '#d97706' }}
                      >
                        <span>
                          {errCount > 0 ? `${errCount} bug${errCount > 1 ? 's' : ''}` : ''}
                          {errCount > 0 && warnCount > 0 ? ' · ' : ''}
                          {warnCount > 0 ? `${warnCount} warn` : ''}
                        </span>
                      </button>
                    )}
                    {outputCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (showLog && logTab === 'files') {
                            setShowLog(false);
                          } else {
                            setLogTab('files');
                            setShowLog(true);
                          }
                        }}
                        className="inline-flex items-center gap-1 hover:underline tabular-nums"
                        style={{ color: theme.ui.text }}
                        title="Inspect and save compiled sidecar files (.aux, .log, .pdf)"
                      >
                        <FolderOutput className="w-3 h-3" />
                        <span>Outputs ({outputCount})</span>
                      </button>
                    )}
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
                );
              })()}
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
                compileResult={compileResult}
                isCompiling={isCompiling}
                theme={theme}
                onOpenExternal={handleOpenExternalPreview}
                onRecompile={() => handleCompile()}
                onOpenLog={() => setShowLog(true)}
                onSwitchToXelatex={() => {
                  setCompilerSettings((prev) => ({ ...prev, compilerMode: 'xelatex' }));
                  handleCompile('xelatex');
                }}
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
        activeFileDirty={activeFile ? dirtyFileIds.has(activeFile.id) : false}
        bundleDownloadUrl={compileResult?.bundleDownloadUrl}
        onSaveActiveFile={() => handleSaveFile()}
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
        shortcuts={shortcuts}
        onChangeShortcuts={setShortcuts}
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
                compileResult={compileResult}
                isCompiling={isCompiling}
                theme={theme}
                onOpenExternal={() => {}}
                onRecompile={() => handleCompile()}
                onOpenLog={() => setShowLog(true)}
                onSwitchToXelatex={() => {
                  setCompilerSettings((prev) => ({ ...prev, compilerMode: 'xelatex' }));
                  handleCompile('xelatex');
                }}
                isExternalWindow
              />
            </div>
          </div>
        </div>
      )}
      {/* Unsaved Tab Close Confirmation Dialog */}
      {pendingCloseFileId && (() => {
        const pendingFile = project.files.find((f) => f.id === pendingCloseFileId);
        if (!pendingFile) return null;
        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Unsaved changes confirmation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setPendingCloseFileId(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setPendingCloseFileId(null);
              }
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[1px]"
          >
            <div
              className="w-full max-w-md rounded-xl border shadow-2xl overflow-hidden"
              style={{
                backgroundColor: theme.ui.bg,
                borderColor: theme.ui.border,
                color: theme.ui.text,
              }}
            >
              <div className="p-5 space-y-2">
                <h2 className="text-sm font-semibold">
                  Save changes to <span className="font-mono">{pendingFile.name}</span>?
                </h2>
                <p className="text-xs leading-relaxed" style={{ color: theme.ui.textMuted }}>
                  This file has unsaved edits since your last disk save. Save a copy before closing its tab, or close without saving to disk.
                </p>
              </div>
              <div
                className="px-5 py-3 border-t flex items-center justify-end gap-2"
                style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.surface }}
              >
                <button
                  type="button"
                  onClick={() => setPendingCloseFileId(null)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border"
                  style={{
                    borderColor: theme.ui.border,
                    backgroundColor: theme.ui.bg,
                    color: theme.ui.text,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const idToClose = pendingFile.id;
                    setPendingCloseFileId(null);
                    forceCloseFileTab(idToClose);
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border"
                  style={{
                    borderColor: theme.ui.border,
                    backgroundColor: theme.ui.bg,
                    color: theme.ui.textMuted,
                  }}
                >
                  Don&apos;t Save
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const saved = await handleSaveFile(pendingFile);
                    if (saved) {
                      setPendingCloseFileId(null);
                      forceCloseFileTab(pendingFile.id);
                    }
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-md"
                  style={{
                    backgroundColor: theme.ui.accent,
                    color: theme.ui.accentFg,
                  }}
                >
                  Save &amp; Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
