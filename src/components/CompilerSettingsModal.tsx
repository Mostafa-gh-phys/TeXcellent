import React, { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle2, PlugZap, AlertTriangle, Cpu, SlidersHorizontal } from 'lucide-react';
import {
  BibliographyTool,
  CompilerInteractionMode,
  CompilerMode,
  CompilerPasses,
  CompilerSettings,
  DetectedTexInstallation,
  OutputFormat,
} from '../types/latex';
import { EditorTheme } from '../utils/themes';
import { buildCompilerCliArgs } from '../utils/compilerArgs';
import { ModalShell } from './ModalShell';

type CompilerModalTab = 'engine' | 'pipeline';

interface CompilerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: EditorTheme;
  settings: CompilerSettings;
  onChange: (next: CompilerSettings) => void;
  detectedTex: DetectedTexInstallation | null;
  onRescanLocalTex: () => Promise<void> | void;
}

const MODES: Array<{ id: CompilerMode; label: string; desc: string }> = [
  { id: 'xelatex', label: 'XeLaTeX', desc: 'UTF-8, OpenType fonts, XePersian & BiDi' },
  { id: 'pdflatex', label: 'PDFLaTeX', desc: 'Classic fast 8-bit TeX direct to PDF' },
  { id: 'lualatex', label: 'LuaLaTeX', desc: 'Lua scripting + modern OpenType fonts' },
  { id: 'latex', label: 'LaTeX (DVI)', desc: 'DVI/PostScript pipeline for PSTricks' },
  { id: 'latexmk', label: 'Latexmk', desc: 'Automated multi-pass + BibTeX/Biber' },
];

const INTERACTION_MODES: Array<{ id: CompilerInteractionMode; label: string; note: string }> = [
  { id: 'nonstopmode', label: 'nonstopmode', note: 'Recommended — runs without pausing for input' },
  { id: 'batchmode', label: 'batchmode', note: 'Minimal console output, suppresses terminal prompt' },
  { id: 'scrollmode', label: 'scrollmode', note: 'Scrolls past missing-file / mild warnings' },
  { id: 'errorstopmode', label: 'errorstopmode', note: 'Strict halt on first interactive error' },
];

interface ConnectionTestResult {
  connected: boolean;
  message: string;
  binaryPath?: string | null;
  versionBanner?: string | null;
  kpsewhichAvailable?: boolean;
  sampleChecked?: boolean;
}

export const CompilerSettingsModal: React.FC<CompilerSettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  settings,
  onChange,
  detectedTex,
  onRescanLocalTex,
}) => {
  const [activeTab, setActiveTab] = useState<CompilerModalTab>('engine');
  const [localDetected, setLocalDetected] = useState<DetectedTexInstallation | null>(detectedTex);
  const [isScanning, setIsScanning] = useState(false);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [connResult, setConnResult] = useState<ConnectionTestResult | null>(null);

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

  const handleTestConnection = async () => {
    setIsTestingConn(true);
    setConnResult(null);
    try {
      const res = await fetch('/api/compiler/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: settings.compilerMode,
          customBinaryPath: settings.customBinaryPath,
          remoteEndpointUrl: settings.remoteEndpointUrl,
        }),
      });
      const data = (await res.json()) as ConnectionTestResult;
      setConnResult(data);
    } catch (err) {
      setConnResult({
        connected: false,
        message: err instanceof Error ? err.message : 'Backend connection check failed.',
      });
    } finally {
      setIsTestingConn(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    handleScan();
    setConnResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const detectedEntries = Object.entries(localDetected?.binaries || {});
  const foundBinaries = detectedEntries.filter(([, info]) => Boolean(info));

  const applyDetected = () => {
    if (!localDetected?.hasNative) return;
    onChange({
      ...settings,
      customBinaryPath: localDetected.detectedBinDir || settings.customBinaryPath,
    });
  };

  const cliPreview = [
    settings.compilerMode,
    ...buildCompilerCliArgs(settings.compilerMode, 'main.tex', settings),
  ].join(' ');

  return (
    <ModalShell<CompilerModalTab>
      isOpen={isOpen}
      onClose={onClose}
      theme={theme}
      ariaLabel="Compiler Settings and Local TeX Connection"
      title="Compiler Settings & TeX Backend"
      subtitle="Configure TeX engine, local TeX Live / MiKTeX path, passes, and CLI flags"
      icon={<Cpu className="w-4 h-4" />}
      maxWidthClass="max-w-2xl"
      tabs={[
        {
          id: 'engine',
          label: 'Engine & Local TeX',
          icon: <Cpu className="w-3.5 h-3.5" />,
          badge: localDetected?.hasNative ? 'Local TeX' : 'Built-in',
        },
        {
          id: 'pipeline',
          label: 'Build Pipeline & Flags',
          icon: <SlidersHorizontal className="w-3.5 h-3.5" />,
        },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      footer={
        <>
          <code
            className="text-[11px] font-mono truncate max-w-[75%]"
            style={{ color: theme.ui.textMuted }}
            title={cliPreview}
          >
            $ {cliPreview}
          </code>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-md shrink-0"
            style={{ backgroundColor: theme.ui.accent, color: theme.ui.accentFg }}
          >
            Done
          </button>
        </>
      }
    >
      {activeTab === 'engine' ? (
        <div className="space-y-4">
          {/* Engine Mode */}
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: theme.ui.textMuted }}>
              Select TeX Compiler Engine
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MODES.map((m) => {
                const selected = settings.compilerMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChange({ ...settings, compilerMode: m.id })}
                    className="p-2.5 text-left rounded-lg border transition-colors flex items-center justify-between gap-2"
                    style={{
                      backgroundColor: selected ? theme.ui.surfaceAlt : theme.ui.surface,
                      borderColor: selected ? theme.ui.accent : theme.ui.border,
                      color: theme.ui.text,
                    }}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold">{m.label}</div>
                      <div className="text-[11px] truncate" style={{ color: theme.ui.textMuted }}>
                        {m.desc}
                      </div>
                    </div>
                    {selected && (
                      <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: theme.ui.accent }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Local TeX Live & MiKTeX Connection & Diagnostics */}
          <div
            className="p-3.5 rounded-lg border space-y-2.5"
            style={{ backgroundColor: theme.ui.surface, borderColor: theme.ui.border }}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="text-xs font-semibold flex items-center gap-2">
                  <span>Local TeX Live / MiKTeX Backend</span>
                  <span
                    className="px-1.5 py-0.5 text-[10px] rounded border font-medium"
                    style={{
                      borderColor: localDetected?.hasNative ? '#16a34a' : theme.ui.border,
                      color: localDetected?.hasNative ? '#16a34a' : theme.ui.textMuted,
                    }}
                  >
                    {localDetected?.hasNative
                      ? `Connected · ${localDetected.detectedFamily || 'Local TeX'}`
                      : 'Built-in Fallback'}
                  </span>
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: theme.ui.textMuted }}>
                  {localDetected?.hasNative
                    ? `Detected: ${localDetected.versionBanner || localDetected.detectedFamily} (${localDetected.detectedBinDir})`
                    : 'No local TeX Live or MiKTeX binaries detected on PATH. Built-in typesetter active.'}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
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
                    Use Detected Path
                  </button>
                )}
                <button
                  type="button"
                  disabled={isTestingConn}
                  onClick={handleTestConnection}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border whitespace-nowrap"
                  style={{
                    backgroundColor: theme.ui.bg,
                    borderColor: theme.ui.border,
                    color: theme.ui.text,
                  }}
                >
                  <PlugZap className="w-3.5 h-3.5" />
                  {isTestingConn ? 'Testing...' : 'Test Connection'}
                </button>
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
                  Rescan
                </button>
              </div>
            </div>

            {connResult && (
              <div
                className="p-2.5 rounded border text-xs flex items-start gap-2"
                style={{
                  backgroundColor: theme.ui.bg,
                  borderColor: connResult.connected ? '#16a34a' : '#d97706',
                }}
              >
                {connResult.connected ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <div className="font-medium">{connResult.message}</div>
                  {connResult.binaryPath && (
                    <div className="text-[11px] font-mono" style={{ color: theme.ui.textMuted }}>
                      Binary: {connResult.binaryPath}
                      {connResult.kpsewhichAvailable ? ' · kpsewhich OK' : ''}
                    </div>
                  )}
                </div>
              </div>
            )}

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
        </div>
      ) : (
        <div className="space-y-4">
          {/* Common TeX Compiler Options */}
          <div
            className="p-3.5 rounded-lg border space-y-3.5"
            style={{ backgroundColor: theme.ui.surface, borderColor: theme.ui.border }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="compiler-interaction-mode"
                  className="block text-xs font-medium mb-1"
                  style={{ color: theme.ui.textMuted }}
                >
                  Interaction Mode (<code className="font-mono">-interaction</code>)
                </label>
                <select
                  id="compiler-interaction-mode"
                  value={settings.interactionMode}
                  onChange={(e) =>
                    onChange({
                      ...settings,
                      interactionMode: e.target.value as CompilerInteractionMode,
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded border"
                  style={{
                    backgroundColor: theme.ui.bg,
                    borderColor: theme.ui.border,
                    color: theme.ui.text,
                  }}
                >
                  {INTERACTION_MODES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} — {m.note}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="compiler-passes"
                  className="block text-xs font-medium mb-1"
                  style={{ color: theme.ui.textMuted }}
                >
                  Compilation Passes (Cross-Refs / TOC)
                </label>
                <select
                  id="compiler-passes"
                  value={settings.compilePasses}
                  onChange={(e) =>
                    onChange({
                      ...settings,
                      compilePasses: e.target.value as CompilerPasses,
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded border"
                  style={{
                    backgroundColor: theme.ui.bg,
                    borderColor: theme.ui.border,
                    color: theme.ui.text,
                  }}
                >
                  <option value="auto">Auto (2–3 passes when refs/bib detected)</option>
                  <option value="1">Single Pass (Fastest)</option>
                  <option value="2">2 Passes (TOC &amp; \ref)</option>
                  <option value="3">3 Passes (Full Citation / Label Settlement)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="compiler-bib-tool"
                  className="block text-xs font-medium mb-1"
                  style={{ color: theme.ui.textMuted }}
                >
                  Bibliography Processor
                </label>
                <select
                  id="compiler-bib-tool"
                  value={settings.bibliographyTool}
                  onChange={(e) =>
                    onChange({
                      ...settings,
                      bibliographyTool: e.target.value as BibliographyTool,
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded border"
                  style={{
                    backgroundColor: theme.ui.bg,
                    borderColor: theme.ui.border,
                    color: theme.ui.text,
                  }}
                >
                  <option value="auto">Auto-detect (BibTeX / Biber)</option>
                  <option value="bibtex">BibTeX</option>
                  <option value="biber">Biber (biblatex)</option>
                  <option value="none">None (Skip bibliography step)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="compiler-output-format"
                  className="block text-xs font-medium mb-1"
                  style={{ color: theme.ui.textMuted }}
                >
                  Output Format
                </label>
                <select
                  id="compiler-output-format"
                  value={settings.outputFormat}
                  onChange={(e) =>
                    onChange({
                      ...settings,
                      outputFormat: e.target.value as OutputFormat,
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded border"
                  style={{
                    backgroundColor: theme.ui.bg,
                    borderColor: theme.ui.border,
                    color: theme.ui.text,
                  }}
                >
                  <option value="pdf">PDF (Standard)</option>
                  <option value="dvi">DVI / XDV (Intermediate)</option>
                  <option value="draft">Draft Mode (Fast syntax check)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
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
                  checked={settings.haltOnError}
                  onChange={(e) => onChange({ ...settings, haltOnError: e.target.checked })}
                />
                <span>
                  Halt on First Error (<code className="font-mono">-halt-on-error</code>)
                </span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.fileLineError}
                  onChange={(e) => onChange({ ...settings, fileLineError: e.target.checked })}
                />
                <span>
                  File:Line Diagnostics (<code className="font-mono">-file-line-error</code>)
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

            <div>
              <label
                htmlFor="compiler-extra-args"
                className="block text-xs font-medium mb-1"
                style={{ color: theme.ui.textMuted }}
              >
                Extra TeX CLI Flags (Optional)
              </label>
              <input
                id="compiler-extra-args"
                type="text"
                value={settings.extraArgs}
                onChange={(e) => onChange({ ...settings, extraArgs: e.target.value })}
                placeholder="-recorder -max-print-line=120"
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded border"
                style={{
                  backgroundColor: theme.ui.bg,
                  borderColor: theme.ui.border,
                  color: theme.ui.text,
                }}
              />
            </div>
          </div>

          {/* Paths */}
          <div
            className="p-3.5 rounded-lg border grid grid-cols-1 sm:grid-cols-2 gap-3"
            style={{ backgroundColor: theme.ui.surface, borderColor: theme.ui.border }}
          >
            <div>
              <label
                htmlFor="tex-bin-path"
                className="block text-xs font-medium mb-1"
                style={{ color: theme.ui.textMuted }}
              >
                Local TeX Bin Directory (Optional)
              </label>
              <input
                id="tex-bin-path"
                type="text"
                value={settings.customBinaryPath}
                onChange={(e) => onChange({ ...settings, customBinaryPath: e.target.value })}
                placeholder="/usr/local/texlive/2026/bin/x86_64-linux"
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded border"
                style={{
                  backgroundColor: theme.ui.bg,
                  borderColor: theme.ui.border,
                  color: theme.ui.text,
                }}
              />
            </div>
            <div>
              <label
                htmlFor="remote-tex-url"
                className="block text-xs font-medium mb-1"
                style={{ color: theme.ui.textMuted }}
              >
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
        </div>
      )}
    </ModalShell>
  );
};
