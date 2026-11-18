export type CompilerMode = 'xelatex' | 'pdflatex' | 'lualatex' | 'latex' | 'latexmk';

export type TexDistribution =
  | 'texlive-2025'
  | 'texlive-2024'
  | 'miktex-24'
  | 'miktex-portable';

export type TexEdition = 'full' | 'medium' | 'basic';

export type CompilerInteractionMode =
  | 'nonstopmode'
  | 'batchmode'
  | 'errorstopmode'
  | 'scrollmode';

export type CompilerPasses = 'auto' | '1' | '2' | '3';

export type BibliographyTool = 'auto' | 'none' | 'bibtex' | 'biber';

export type OutputFormat = 'pdf' | 'dvi' | 'draft';

export type ThemeId =
  | 'github-light'
  | 'github-dark'
  | 'mathematica'
  | 'nord'
  | 'solarized-light'
  | 'tokyo-night'
  | 'monokai'
  | 'overleaf-crisp'
  | 'dracula'
  | 'one-dark'
  | 'catppuccin-mocha'
  | 'catppuccin-latte'
  | 'gruvbox-dark';

export type DirectionMode = 'auto' | 'ltr' | 'rtl';

export type PreviewMode = 'beside' | 'external' | 'editor-only';

export type EditorFontId =
  | 'jetbrains'
  | 'cascadia-code'
  | 'ibm-plex'
  | 'fira-code'
  | 'source-code'
  | 'roboto-mono'
  | 'inconsolata'
  | 'ubuntu-mono'
  | 'space-mono'
  | 'noto-sans-mono'
  | 'vazirmatn'
  | 'noto-naskh'
  | 'system-mono';

export interface ProjectFile {
  id: string;
  name: string;
  content: string;
  language: 'latex' | 'bibtex' | 'style' | 'asset';
  binaryBase64?: string;
  mimeType?: string;
  updatedAt: string;
}

export interface LatexProject {
  id: string;
  name: string;
  mainFileId: string;
  files: ProjectFile[];
  compilerMode: CompilerMode;
  distribution?: TexDistribution;
  edition?: TexEdition;
  updatedAt: string;
}

export interface CompileLogEntry {
  level: 'info' | 'warning' | 'error';
  line?: number;
  file?: string;
  message: string;
}

export interface CompileResult {
  success: boolean;
  compileId: string;
  pdfUrl: string;
  durationMs: number;
  pageCount: number;
  engineLabel: string;
  distributionLabel: string;
  backendType: 'native-binary' | 'remote-endpoint' | 'built-in-typesetter';
  rawLog: string;
  diagnostics: CompileLogEntry[];
  generatedFiles?: Array<{ name: string; sizeBytes: number }>;
  timestamp: string;
}

export interface CompilerSettings {
  compilerMode: CompilerMode;
  customBinaryPath: string;
  remoteEndpointUrl: string;
  shellEscape: boolean;
  synctex: boolean;
  interactionMode: CompilerInteractionMode;
  compilePasses: CompilerPasses;
  bibliographyTool: BibliographyTool;
  outputFormat: OutputFormat;
  fileLineError: boolean;
  haltOnError: boolean;
  extraArgs: string;
  /** Kept optional for backwards-compatible persistence only; not shown in UI */
  distribution?: TexDistribution;
  edition?: TexEdition;
}

export interface DetectedTexInstallation {
  hasNative: boolean;
  detectedDistribution: TexDistribution | null;
  detectedFamily?: 'TeX Live' | 'MiKTeX' | 'TinyTeX' | 'TeX' | null;
  detectedBinDir: string | null;
  versionBanner: string | null;
  binaries: Record<string, { path: string; version: string; distribution: string } | null>;
}

export interface SyncConfig {
  github: {
    connected: boolean;
    username: string;
    token: string;
    repo: string;
    branch: string;
    basePath: string;
    lastSyncedAt?: string;
  };
  overleaf: {
    projectId: string;
    gitToken: string;
    customHost: string;
    lastSyncedAt?: string;
  };
  easytex: {
    projectUrl: string;
    apiToken: string;
    instanceUrl: string;
    lastSyncedAt?: string;
  };
}
