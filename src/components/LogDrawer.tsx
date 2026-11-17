import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bug,
  CheckCircle2,
  Info,
  Terminal,
  X,
} from 'lucide-react';
import { CompileLogEntry, CompileResult } from '../types/latex';
import { EditorTheme } from '../utils/themes';

export type LogDrawerTab = 'bugs' | 'log';

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
  const issues: CompileLogEntry[] = (compileResult.diagnostics || [])
    .filter((d) => d.level === 'error' || d.level === 'warning')
    .sort((a, b) => {
      if (a.level === b.level) return (a.line || 0) - (b.line || 0);
      return a.level === 'error' ? -1 : 1;
    });

  const errorCount = issues.filter((d) => d.level === 'error').length;
  const warningCount = issues.filter((d) => d.level === 'warning').length;

  return (
    <div
      aria-label="Compiler Output and Bugs Panel"
      data-testid="compiler-log-drawer"
      className="h-48 border-t flex flex-col shrink-0 overflow-hidden"
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
        <div role="tablist" aria-label="Compiler panel tabs" className="flex items-center gap-1.5">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'bugs'}
            onClick={() => onChangeTab('bugs')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border transition-colors"
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
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border transition-colors"
            style={{
              backgroundColor: activeTab === 'log' ? theme.ui.bg : 'transparent',
              borderColor: activeTab === 'log' ? theme.ui.border : 'transparent',
              color: activeTab === 'log' ? theme.ui.text : theme.ui.textMuted,
            }}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Compiler Log</span>
          </button>

          <span
            className="hidden sm:inline text-[11px] font-mono ml-2 truncate"
            style={{ color: theme.ui.textMuted }}
          >
            {compileResult.engineLabel} · {compileResult.distributionLabel}
            {compileResult.generatedFiles && compileResult.generatedFiles.length > 0
              ? ` · ${compileResult.generatedFiles.map((f) => f.name).join(', ')}`
              : ''}
          </span>
        </div>

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
        ) : (
          <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed opacity-90">
            {compileResult.rawLog}
          </pre>
        )}
      </div>
    </div>
  );
};
