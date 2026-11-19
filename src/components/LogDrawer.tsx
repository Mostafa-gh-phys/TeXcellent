import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  Bug,
  CheckCircle2,
  Download,
  Eye,
  FileCode2,
  FolderOutput,
  Info,
  Loader2,
  Terminal,
  X,
} from 'lucide-react';
import { CompileGeneratedFile, CompileLogEntry, CompileResult } from '../types/latex';
import { EditorTheme } from '../utils/themes';
import { formatArtifactSize } from '../utils/texArtifacts';

export type LogDrawerTab = 'bugs' | 'log' | 'files';

interface LogDrawerProps {
  compileResult: CompileResult;
  activeTab: LogDrawerTab;
  onChangeTab: (tab: LogDrawerTab) => void;
  onClose: () => void;
  onJumpToLine?: (line: number, fileName?: string) => void;
  onSwitchToXelatex?: () => void;
  theme: EditorTheme;
}

export const LogDrawer: React.FC<LogDrawerProps> = ({
  compileResult,
  activeTab,
  onChangeTab,
  onClose,
  onJumpToLine,
  onSwitchToXelatex,
  theme,
}) => {
  const [inspectedFile, setInspectedFile] = useState<CompileGeneratedFile | null>(null);
  const [inspectedContent, setInspectedContent] = useState<string>('');
  const [inspectLoading, setInspectLoading] = useState<boolean>(false);
  const [inspectError, setInspectError] = useState<string>('');

  const issues: CompileLogEntry[] = (compileResult.diagnostics || [])
    .filter((d) => d.level === 'error' || d.level === 'warning')
    .sort((a, b) => {
      if (a.level === b.level) return (a.line || 0) - (b.line || 0);
      return a.level === 'error' ? -1 : 1;
    });

  const errorCount = issues.filter((d) => d.level === 'error').length;
  const warningCount = issues.filter((d) => d.level === 'warning').length;
  const generatedFiles = compileResult.generatedFiles || [];

  const handleInspectFile = async (file: CompileGeneratedFile) => {
    if (inspectedFile?.name === file.name && inspectedFile?.downloadUrl === file.downloadUrl) {
      setInspectedFile(null);
      setInspectedContent('');
      setInspectError('');
      return;
    }

    setInspectedFile(file);
    setInspectError('');

    if (file.name.toLowerCase().endsWith('.log') && compileResult.rawLog) {
      setInspectedContent(compileResult.rawLog);
      return;
    }

    if (!file.downloadUrl) {
      setInspectError(`No preview endpoint available for ${file.name}.`);
      return;
    }

    setInspectLoading(true);
    setInspectError('');
    setInspectedContent('');
    try {
      const sep = file.downloadUrl.includes('?') ? '&' : '?';
      const res = await fetch(`${file.downloadUrl}${sep}inline=1`);
      if (!res.ok) {
        throw new Error(`Could not load ${file.name} (${res.status})`);
      }
      const text = await res.text();
      setInspectedContent(text || `(empty ${file.name})`);
    } catch (err) {
      setInspectError(err instanceof Error ? err.message : `Failed to inspect ${file.name}`);
    } finally {
      setInspectLoading(false);
    }
  };

  return (
    <div
      aria-label="Compiler Output and Bugs Panel"
      data-testid="compiler-log-drawer"
      className="h-52 border-t flex flex-col shrink-0 overflow-hidden"
      style={{
        backgroundColor: theme.ui.surface,
        borderColor: theme.ui.border,
        color: theme.ui.text,
      }}
    >
      {/* Tabs Header */}
      <div
        className="flex items-center justify-between gap-2 px-3 py-1.5 border-b shrink-0"
        style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.surfaceAlt }}
      >
        <div role="tablist" aria-label="Compiler panel tabs" className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'bugs'}
            onClick={() => onChangeTab('bugs')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border transition-colors whitespace-nowrap"
            style={{
              backgroundColor: activeTab === 'bugs' ? theme.ui.bg : 'transparent',
              borderColor: activeTab === 'bugs' ? theme.ui.border : 'transparent',
              color: activeTab === 'bugs' ? theme.ui.text : theme.ui.textMuted,
            }}
          >
            <Bug className="w-3.5 h-3.5" />
            <span>Bugs</span>
            <span
              className="px-1.5 py-0.2 text-[10px] rounded tabular-nums font-semibold"
              style={{
                backgroundColor:
                  errorCount > 0
                    ? 'rgba(220, 38, 38, 0.14)'
                    : warningCount > 0
                      ? 'rgba(217, 119, 6, 0.16)'
                      : theme.ui.surface,
                color:
                  errorCount > 0
                    ? '#dc2626'
                    : warningCount > 0
                      ? '#d97706'
                      : theme.ui.textMuted,
              }}
            >
              {issues.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'log'}
            onClick={() => onChangeTab('log')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border transition-colors whitespace-nowrap"
            style={{
              backgroundColor: activeTab === 'log' ? theme.ui.bg : 'transparent',
              borderColor: activeTab === 'log' ? theme.ui.border : 'transparent',
              color: activeTab === 'log' ? theme.ui.text : theme.ui.textMuted,
            }}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Compiler Log</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'files'}
            onClick={() => onChangeTab('files')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border transition-colors whitespace-nowrap"
            style={{
              backgroundColor: activeTab === 'files' ? theme.ui.bg : 'transparent',
              borderColor: activeTab === 'files' ? theme.ui.border : 'transparent',
              color: activeTab === 'files' ? theme.ui.text : theme.ui.textMuted,
            }}
          >
            <FolderOutput className="w-3.5 h-3.5" />
            <span>Output Files</span>
            <span
              className="px-1.5 py-0.2 text-[10px] rounded tabular-nums font-semibold"
              style={{
                backgroundColor: theme.ui.surface,
                color: theme.ui.textMuted,
              }}
            >
              {generatedFiles.length}
            </span>
          </button>

          <span
            className="hidden lg:inline text-[11px] font-mono ml-2 truncate"
            style={{ color: theme.ui.textMuted }}
          >
            {compileResult.engineLabel} · {compileResult.distributionLabel}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {compileResult.bundleDownloadUrl && generatedFiles.length > 0 && (
            <a
              href={compileResult.bundleDownloadUrl}
              download="compile-outputs.zip"
              className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border hover:opacity-80"
              style={{
                backgroundColor: theme.ui.bg,
                borderColor: theme.ui.border,
                color: theme.ui.text,
              }}
              title="Download PDF, .aux, .log, and all build artifacts as ZIP"
            >
              <Archive className="w-3 h-3" />
              <span>Save All (.zip)</span>
            </a>
          )}
          <button
            type="button"
            aria-label="Close compiler log"
            onClick={onClose}
            className="p-1 rounded hover:opacity-75 shrink-0"
            style={{ color: theme.ui.textMuted }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-2.5">
        {activeTab === 'bugs' ? (
          issues.length === 0 ? (
            <div className="h-full flex items-center justify-center gap-2 text-xs py-4">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span style={{ color: theme.ui.textMuted }}>
                No code bugs or compiler warnings ({compileResult.engineLabel}).
              </span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {issues.map((item, idx) => {
                const isError = item.level === 'error';
                const canSwitchXelatex =
                  Boolean(onSwitchToXelatex) &&
                  compileResult.engineLabel !== 'XELATEX' &&
                  /xepersian|fontspec|bidi|xetex|xelatex/i.test(item.message);
                return (
                  <div
                    key={`${item.level}-${item.line || 0}-${idx}`}
                    className="flex items-start justify-between gap-2 px-2.5 py-2 rounded border text-xs"
                    style={{
                      backgroundColor: theme.ui.bg,
                      borderColor: isError ? 'rgba(220, 38, 38, 0.35)' : 'rgba(217, 119, 6, 0.35)',
                    }}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      {isError ? (
                        <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                      ) : item.level === 'warning' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      ) : (
                        <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-[10px] font-semibold uppercase tracking-wide"
                            style={{ color: isError ? '#dc2626' : '#d97706' }}
                          >
                            {isError ? 'Error' : 'Warning'}
                          </span>
                          {(item.file || item.line) && (
                            <button
                              type="button"
                              onClick={() => item.line && onJumpToLine?.(item.line, item.file)}
                              className="text-[11px] font-mono underline underline-offset-2 hover:opacity-80"
                              style={{ color: theme.ui.accent }}
                            >
                              {item.file ? `${item.file}` : 'line'}
                              {item.line ? `:${item.line}` : ''}
                            </button>
                          )}
                        </div>
                        <p className="leading-snug break-words" style={{ color: theme.ui.text }}>
                          {item.message}
                        </p>
                      </div>
                    </div>

                    {canSwitchXelatex && (
                      <button
                        type="button"
                        onClick={onSwitchToXelatex}
                        className="px-2 py-1 text-[11px] font-semibold rounded whitespace-nowrap shrink-0"
                        style={{
                          backgroundColor: theme.ui.accent,
                          color: theme.ui.accentFg,
                        }}
                      >
                        Use XeLaTeX
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : activeTab === 'files' ? (
          generatedFiles.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs py-4" style={{ color: theme.ui.textMuted }}>
              Sidecar output files (.aux, .log, .toc, .pdf) appear here after compiling.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {generatedFiles.map((file) => {
                  const isInspecting =
                    inspectedFile?.name === file.name &&
                    inspectedFile?.downloadUrl === file.downloadUrl;
                  return (
                    <div
                      key={file.name}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border text-xs"
                      style={{
                        backgroundColor: theme.ui.bg,
                        borderColor: isInspecting ? theme.ui.accent : theme.ui.border,
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileCode2 className="w-3.5 h-3.5 shrink-0 opacity-75" />
                        <div className="min-w-0">
                          <div className="font-mono text-xs font-medium truncate" title={file.name}>
                            {file.name}
                          </div>
                          <div className="text-[10px] tabular-nums" style={{ color: theme.ui.textMuted }}>
                            {formatArtifactSize(file.sizeBytes)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {file.inspectable && (
                          <button
                            type="button"
                            onClick={() => handleInspectFile(file)}
                            aria-label={`Inspect ${file.name}`}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded border hover:opacity-85"
                            style={{
                              backgroundColor: isInspecting ? theme.ui.accent : theme.ui.surface,
                              borderColor: isInspecting ? theme.ui.accent : theme.ui.border,
                              color: isInspecting ? theme.ui.accentFg : theme.ui.text,
                            }}
                          >
                            <Eye className="w-3 h-3" />
                            <span>{isInspecting ? 'Hide' : 'Inspect'}</span>
                          </button>
                        )}
                        {file.downloadUrl && (
                          <a
                            href={file.downloadUrl}
                            download={file.name}
                            aria-label={`Save ${file.name}`}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded border hover:opacity-85"
                            style={{
                              backgroundColor: theme.ui.surface,
                              borderColor: theme.ui.border,
                              color: theme.ui.text,
                            }}
                          >
                            <Download className="w-3 h-3" />
                            <span>Save</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {inspectedFile && (
                <div
                  className="rounded border overflow-hidden"
                  style={{ borderColor: theme.ui.border, backgroundColor: theme.editor.bg }}
                >
                  <div
                    className="flex items-center justify-between px-2.5 py-1 border-b text-[11px] font-mono"
                    style={{
                      borderColor: theme.ui.border,
                      backgroundColor: theme.ui.surfaceAlt,
                      color: theme.ui.textMuted,
                    }}
                  >
                    <span>{inspectedFile.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setInspectedFile(null);
                        setInspectedContent('');
                      }}
                      className="hover:opacity-80"
                    >
                      Close preview
                    </button>
                  </div>
                  <div className="p-2.5 max-h-40 overflow-auto">
                    {inspectLoading ? (
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: theme.ui.textMuted }}>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Loading {inspectedFile.name}...</span>
                      </div>
                    ) : inspectError ? (
                      <div className="text-xs text-red-500">{inspectError}</div>
                    ) : (
                      <pre
                        dir="ltr"
                        className="font-mono text-[11px] whitespace-pre-wrap leading-relaxed"
                        style={{ color: theme.editor.fg }}
                      >
                        {inspectedContent}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed opacity-90">
            {compileResult.rawLog}
          </pre>
        )}
      </div>
    </div>
  );
};
