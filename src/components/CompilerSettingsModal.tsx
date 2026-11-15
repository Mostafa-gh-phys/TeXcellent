import React, { useEffect, useState } from 'react';
import { X, RefreshCw, CheckCircle2 } from 'lucide-react';
import {
  CompilerMode,
  CompilerSettings,
  DetectedTexInstallation,
  TexDistribution,
  TexEdition,
} from '../types/latex';
import { EditorTheme } from '../utils/themes';

interface CompilerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: EditorTheme;
  settings: CompilerSettings;
  onChange: (next: CompilerSettings) => void;
  detectedTex: DetectedTexInstallation | null;
  onRescanLocalTex: () => Promise<void> | void;
}

const DISTRIBUTIONS: Array<{ id: TexDistribution; name: string; note: string }> = [
  { id: 'texlive-2025', name: 'TeX Live 2025', note: 'Latest upstream CTAN & XePersian' },
  { id: 'texlive-2024', name: 'TeX Live 2024 LTS', note: 'Frozen long-term support tree' },
  { id: 'miktex-24', name: 'MiKTeX 24.1', note: 'On-the-fly CTAN package installer' },
  { id: 'miktex-portable', name: 'MiKTeX Portable', note: 'Self-contained portable distribution' },
];

const EDITIONS: Array<{ id: TexEdition; name: string; note: string }> = [
  { id: 'full', name: 'Full / Complete', note: 'All CTAN, TikZ, XePersian & fonts (~5 GB)' },
  { id: 'medium', name: 'Medium Scheme', note: 'Standard academic, math & graphics packages' },
  { id: 'basic', name: 'Basic Scheme', note: 'Minimal LaTeX kernel + essential math only' },
];

const MODES: Array<{ id: CompilerMode; label: string; desc: string }> = [
  { id: 'xelatex', label: 'XeLaTeX', desc: 'Native UTF-8, OpenType fonts, XePersian & BiDi' },
  { id: 'pdflatex', label: 'PDFLaTeX', desc: 'Fast classic 8-bit TeX direct to PDF' },
  { id: 'lualatex', label: 'LuaLaTeX', desc: 'Embedded Lua scripting + OpenType fonts' },
  { id: 'latex', label: 'LaTeX (DVI → PDF)', desc: 'Classic DVI/PostScript pipeline for PSTricks' },
  { id: 'latexmk', label: 'Latexmk', desc: 'Multi-pass automated build with BibTeX/Biber' },
];

export const CompilerSettingsModal: React.FC<CompilerSettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  settings,
  onChange,
  detectedTex,
  onRescanLocalTex,
}) => {
  const [localDetected, setLocalDetected] = useState<DetectedTexInstallation | null>(detectedTex);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    setLocalDetected(detectedTex);
  }, [detectedTex]);

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const r = await fetch(
        `/api/compiler/status?customDir=${encodeURIComponent(settings.customBinaryPath || '')}`
      );
      const d = (await r.json()) as DetectedTexInstallation;
      setLocalDetected(d);
      await onRescanLocalTex();
    } catch {
      // ignore scan error
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    handleScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const detectedEntries = Object.entries(localDetected?.binaries || {});
  const foundBinaries = detectedEntries.filter(([, info]) => Boolean(info));

  const applyDetected = () => {
    if (!localDetected?.hasNative) return;
    onChange({
      ...settings,
      distribution: localDetected.detectedDistribution || settings.distribution,
      customBinaryPath: localDetected.detectedBinDir || settings.customBinaryPath,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Compiler and TeX Distribution Settings"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        className="w-full max-w-2xl rounded-xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          backgroundColor: theme.ui.bg,
          borderColor: theme.ui.border,
          color: theme.ui.text,
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b"
          style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.surface }}
        >
          <div>
            <h2 className="text-base font-semibold">Compiler Engine &amp; TeX Distribution</h2>
            <p className="text-xs" style={{ color: theme.ui.textMuted }}>
              Autodetect local TeX Live / MiKTeX installations, choose edition scheme, and engine mode
            </p>
          </div>
          <button
            type="button"
            aria-label="Close compiler settings"
            onClick={onClose}
            className="p-1.5 rounded-md hover:opacity-75"
            style={{ color: theme.ui.textMuted }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {/* Autodetection Panel */}
          <div
            className="p-3.5 rounded-lg border space-y-2.5"
            style={{ backgroundColor: theme.ui.surface, borderColor: theme.ui.border }}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="text-xs font-semibold">
                  Local TeX Live &amp; MiKTeX Autodetection
                </div>
                <div className="text-[11px]" style={{ color: theme.ui.textMuted }}>
                  {localDetected?.hasNative
                    ? `Detected: ${localDetected.versionBanner || localDetected.detectedDistribution} (${localDetected.detectedBinDir})`
                    : 'No local TeX Live or MiKTeX binaries detected on host PATH or standard install directories. Built-in typesetter active.'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {localDetected?.hasNative && (
                  <button
                    type="button"
                    onClick={applyDetected}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border whitespace-nowrap"
                    style={{
                      backgroundColor: theme.ui.bg,
                      borderColor: theme.ui.accent,
                      color: theme.ui.accent,
                    }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Apply Detected
                  </button>
                )}
                <button
                  type="button"
                  disabled={isScanning}
                  onClick={handleScan}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border whitespace-nowrap"
                  style={{
                    backgroundColor: theme.ui.bg,
                    borderColor: theme.ui.border,
                    color: theme.ui.text,
                  }}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                  Scan Local TeX
                </button>
              </div>
            </div>

            {foundBinaries.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                {foundBinaries.map(([cmd, info]) => (
                  <div
                    key={cmd}
                    className="text-[11px] font-mono px-2 py-1 rounded border truncate"
                    style={{
                      backgroundColor: theme.ui.bg,
                      borderColor: theme.ui.border,
                      color: theme.ui.text,
                    }}
                    title={info?.path}
                  >
                    {cmd}: {info?.path}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Distribution */}
          <div>
            <div className="text-xs font-medium mb-2" style={{ color: theme.ui.textMuted }}>
              Backend TeX Distribution
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {DISTRIBUTIONS.map((d) => {
                const selected = settings.distribution === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onChange({ ...settings, distribution: d.id })}
                    className="text-left p-3 rounded-lg border transition-colors"
                    style={{
                      backgroundColor: selected ? theme.ui.surfaceAlt : theme.ui.surface,
                      borderColor: selected ? theme.ui.accent : theme.ui.border,
                    }}
                  >
                    <div className="text-xs font-semibold">{d.name}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: theme.ui.textMuted }}>
                      {d.note}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Edition */}
          <div>
            <div className="text-xs font-medium mb-2" style={{ color: theme.ui.textMuted }}>
              Distribution Edition / Package Scheme
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {EDITIONS.map((ed) => {
                const selected = settings.edition === ed.id;
                return (
                  <button
                    key={ed.id}
                    type="button"
                    onClick={() => onChange({ ...settings, edition: ed.id })}
                    className="text-left p-3 rounded-lg border transition-colors"
                    style={{
                      backgroundColor: selected ? theme.ui.surfaceAlt : theme.ui.surface,
                      borderColor: selected ? theme.ui.accent : theme.ui.border,
                    }}
                  >
                    <div className="text-xs font-semibold">{ed.name}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: theme.ui.textMuted }}>
                      {ed.note}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Engine Mode */}
          <div>
            <label
              htmlFor="compiler-mode-select"
              className="block text-xs font-medium mb-2"
              style={{ color: theme.ui.textMuted }}
            >
              Compiler Engine Mode
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {MODES.map((m) => {
                const selected = settings.compilerMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    title={m.desc}
                    onClick={() => onChange({ ...settings, compilerMode: m.id })}
                    className="py-2 px-2.5 text-center rounded-lg border text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: selected ? theme.ui.accent : theme.ui.surface,
                      borderColor: selected ? theme.ui.accent : theme.ui.border,
                      color: selected ? theme.ui.accentFg : theme.ui.text,
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Advanced paths & flags */}
          <div
            className="p-3.5 rounded-lg border space-y-3"
            style={{ backgroundColor: theme.ui.surface, borderColor: theme.ui.border }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="tex-bin-path" className="block text-xs font-medium mb-1" style={{ color: theme.ui.textMuted }}>
                  Local TeX Live / MiKTeX Bin Directory (Optional)
                </label>
                <input
                  id="tex-bin-path"
                  type="text"
                  value={settings.customBinaryPath}
                  onChange={(e) => onChange({ ...settings, customBinaryPath: e.target.value })}
                  placeholder="/usr/local/texlive/2025/bin/x86_64-linux"
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded border"
                  style={{
                    backgroundColor: theme.ui.bg,
                    borderColor: theme.ui.border,
                    color: theme.ui.text,
                  }}
                />
              </div>
              <div>
                <label htmlFor="remote-tex-url" className="block text-xs font-medium mb-1" style={{ color: theme.ui.textMuted }}>
                  Remote TeX Compiler URL (Optional)
                </label>
                <input
                  id="remote-tex-url"
                  type="url"
                  value={settings.remoteEndpointUrl}
                  onChange={(e) => onChange({ ...settings, remoteEndpointUrl: e.target.value })}
                  placeholder="https://tex-compiler.example.com/compile"
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded border"
                  style={{
                    backgroundColor: theme.ui.bg,
                    borderColor: theme.ui.border,
                    color: theme.ui.text,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-6 pt-1">
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.synctex}
                  onChange={(e) => onChange({ ...settings, synctex: e.target.checked })}
                />
                <span>
                  Enable SyncTeX (<code className="font-mono">-synctex=1</code>)
                </span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.shellEscape}
                  onChange={(e) => onChange({ ...settings, shellEscape: e.target.checked })}
                />
                <span>
                  Allow Shell Escape (<code className="font-mono">-shell-escape</code>)
                </span>
              </label>
            </div>
          </div>
        </div>

        <div
          className="px-5 py-3 border-t flex justify-end"
          style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.surface }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-md"
            style={{ backgroundColor: theme.ui.accent, color: theme.ui.accentFg }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
