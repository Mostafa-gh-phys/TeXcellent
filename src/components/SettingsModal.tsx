import React, { useEffect, useState } from 'react';
import {
  X,
  Palette,
  Type,
  ArrowLeftRight,
  Check,
  Keyboard,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import {
  DirectionMode,
  EditorFontId,
  ShortcutActionId,
  ShortcutMap,
  ThemeId,
} from '../types/latex';
import { EditorTheme, THEME_LIST } from '../utils/themes';
import { EDITOR_FONT_LIST, EDITOR_FONTS } from '../utils/editorFonts';
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_DEFINITIONS,
  findShortcutConflict,
  formatShortcutLabel,
  keyboardEventToBinding,
} from '../utils/shortcuts';

export type SettingsTabId = 'general' | 'shortcuts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: EditorTheme;
  themeId: ThemeId;
  onChangeTheme: (id: ThemeId) => void;
  editorFontId: EditorFontId;
  onChangeFont: (id: EditorFontId) => void;
  editorFontSize: number;
  onChangeFontSize: (size: number) => void;
  directionMode: DirectionMode;
  onChangeDirectionMode: (mode: DirectionMode) => void;
  keyboardScript: 'ltr' | 'rtl';
  shortcuts: ShortcutMap;
  onChangeShortcuts: (next: ShortcutMap) => void;
}

const FONT_SIZES = [12, 13, 14, 15, 16, 18];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  themeId,
  onChangeTheme,
  editorFontId,
  onChangeFont,
  editorFontSize,
  onChangeFontSize,
  directionMode,
  onChangeDirectionMode,
  keyboardScript,
  shortcuts,
  onChangeShortcuts,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('general');
  const [recordingAction, setRecordingAction] = useState<ShortcutActionId | null>(null);

  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || '');

  useEffect(() => {
    if (!isOpen) {
      setRecordingAction(null);
      return;
    }
    if (!recordingAction) return;

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        setRecordingAction(null);
        return;
      }

      const nextBinding = keyboardEventToBinding({
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
      });
      if (!nextBinding) return;

      onChangeShortcuts({
        ...shortcuts,
        [recordingAction]: nextBinding,
      });
      setRecordingAction(null);
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, recordingAction, shortcuts, onChangeShortcuts]);

  if (!isOpen) return null;

  const activeFont = EDITOR_FONTS[editorFontId] || EDITOR_FONTS.jetbrains;
  const hasCustomShortcuts = SHORTCUT_DEFINITIONS.some(
    (def) => shortcuts[def.id] !== def.defaultBinding
  );

  const renderShortcutRows = (category: 'Workspace' | 'LaTeX Editor') => {
    const defs = SHORTCUT_DEFINITIONS.filter((d) => d.category === category);
    return (
      <div className="space-y-2">
        <h4
          className="text-[11px] font-semibold uppercase tracking-wider px-1"
          style={{ color: theme.ui.textMuted }}
        >
          {category}
        </h4>
        <div
          className="rounded-lg border divide-y overflow-hidden"
          style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.surface }}
        >
          {defs.map((def) => {
            const binding = shortcuts[def.id] || def.defaultBinding;
            const isRecording = recordingAction === def.id;
            const isCustomized = binding !== def.defaultBinding;
            const conflictId = findShortcutConflict(shortcuts, def.id, binding);
            const conflictDef = conflictId
              ? SHORTCUT_DEFINITIONS.find((d) => d.id === conflictId)
              : null;
            const keyParts = formatShortcutLabel(binding, isMac);

            return (
              <div
                key={def.id}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                style={{ borderColor: theme.ui.border }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold">{def.label}</span>
                    {conflictDef && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600">
                        <AlertCircle className="w-3 h-3" />
                        Conflicts with {conflictDef.label}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] truncate" style={{ color: theme.ui.textMuted }}>
                    {def.description}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    data-shortcut-recording={isRecording ? 'true' : undefined}
                    aria-label={`Change shortcut for ${def.label}`}
                    onClick={() =>
                      setRecordingAction((prev) => (prev === def.id ? null : def.id))
                    }
                    className="px-2.5 py-1 rounded-md border text-xs font-mono transition-colors min-w-[110px] flex items-center justify-center gap-1"
                    style={{
                      backgroundColor: isRecording ? theme.ui.accent : theme.ui.bg,
                      borderColor: isRecording ? theme.ui.accent : theme.ui.border,
                      color: isRecording ? theme.ui.accentFg : theme.ui.text,
                    }}
                  >
                    {isRecording ? (
                      <span className="text-[11px] font-sans font-semibold">
                        Press keys...
                      </span>
                    ) : (
                      keyParts.map((part, idx) => (
                        <React.Fragment key={`${part}-${idx}`}>
                          <kbd
                            className="px-1.5 py-0.5 text-[11px] rounded border font-mono leading-none"
                            style={{
                              backgroundColor: theme.ui.surfaceAlt,
                              borderColor: theme.ui.border,
                              color: theme.ui.text,
                            }}
                          >
                            {part}
                          </kbd>
                          {idx < keyParts.length - 1 && (
                            <span className="text-[10px] opacity-60">+</span>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </button>

                  {isCustomized && (
                    <button
                      type="button"
                      aria-label={`Reset shortcut for ${def.label}`}
                      title={`Reset to ${formatShortcutLabel(def.defaultBinding, isMac).join(' + ')}`}
                      onClick={() =>
                        onChangeShortcuts({
                          ...shortcuts,
                          [def.id]: def.defaultBinding,
                        })
                      }
                      className="p-1.5 rounded-md border hover:opacity-80 transition-opacity"
                      style={{
                        borderColor: theme.ui.border,
                        backgroundColor: theme.ui.bg,
                        color: theme.ui.textMuted,
                      }}
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Editor and BiDi Settings"
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
          className="px-5 pt-3.5 pb-0 border-b"
          style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.surface }}
        >
          <div className="flex items-center justify-between pb-3">
            <div>
              <h2 className="text-base font-semibold">Settings</h2>
              <p className="text-xs" style={{ color: theme.ui.textMuted }}>
                Configure theme, typography, bidirectional behavior, and keyboard shortcuts
              </p>
            </div>
            <button
              type="button"
              aria-label="Close settings modal"
              onClick={onClose}
              className="p-1.5 rounded-md hover:opacity-75"
              style={{ color: theme.ui.textMuted }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Settings Modal Tabs */}
          <div role="tablist" aria-label="Settings sections" className="flex items-center gap-4">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'general'}
              onClick={() => {
                setRecordingAction(null);
                setActiveTab('general');
              }}
              className="inline-flex items-center gap-1.5 pb-2.5 text-xs font-semibold border-b-2 transition-colors"
              style={{
                borderBottomColor: activeTab === 'general' ? theme.ui.accent : 'transparent',
                color: activeTab === 'general' ? theme.ui.text : theme.ui.textMuted,
              }}
            >
              <Palette className="w-3.5 h-3.5" />
              Appearance &amp; BiDi
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'shortcuts'}
              onClick={() => setActiveTab('shortcuts')}
              className="inline-flex items-center gap-1.5 pb-2.5 text-xs font-semibold border-b-2 transition-colors"
              style={{
                borderBottomColor: activeTab === 'shortcuts' ? theme.ui.accent : 'transparent',
                color: activeTab === 'shortcuts' ? theme.ui.text : theme.ui.textMuted,
              }}
            >
              <Keyboard className="w-3.5 h-3.5" />
              Shortcuts
            </button>
          </div>
        </div>

        {activeTab === 'general' ? (
          <div className="p-5 overflow-y-auto space-y-6">
            {/* Theme Palette */}
            <section aria-labelledby="settings-theme-heading" className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4" style={{ color: theme.ui.accent }} />
                <h3 id="settings-theme-heading" className="text-sm font-semibold">
                  Color Theme
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {THEME_LIST.map((item) => {
                  const selected = item.id === themeId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onChangeTheme(item.id)}
                      aria-pressed={selected}
                      className="text-left p-3 rounded-lg border flex items-start justify-between gap-3"
                      style={{
                        backgroundColor: selected ? theme.ui.surfaceAlt : theme.ui.surface,
                        borderColor: selected ? theme.ui.accent : theme.ui.border,
                      }}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-sm border shrink-0"
                            style={{
                              backgroundColor: item.editor.bg,
                              borderColor: item.ui.border,
                            }}
                          />
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: item.editor.command }}
                          />
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: item.editor.math }}
                          />
                          <span className="text-xs font-semibold truncate">{item.name}</span>
                        </div>
                        <p className="text-[11px] mt-1 line-clamp-1" style={{ color: theme.ui.textMuted }}>
                          {item.description}
                        </p>
                      </div>
                      {selected && <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: theme.ui.accent }} />}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Typography: Font Family & Font Size */}
            <section aria-labelledby="settings-font-heading" className="space-y-3">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4" style={{ color: theme.ui.accent }} />
                <h3 id="settings-font-heading" className="text-sm font-semibold">
                  Editor Typography
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="settings-font-select"
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: theme.ui.textMuted }}
                  >
                    Font Family
                  </label>
                  <select
                    id="settings-font-select"
                    value={editorFontId}
                    onChange={(e) => onChangeFont(e.target.value as EditorFontId)}
                    className="w-full px-3 py-2 text-xs rounded-lg border outline-none"
                    style={{
                      backgroundColor: theme.ui.surface,
                      borderColor: theme.ui.border,
                      color: theme.ui.text,
                    }}
                  >
                    {EDITOR_FONT_LIST.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: theme.ui.textMuted }}
                  >
                    Font Size ({editorFontSize}px)
                  </span>
                  <div className="grid grid-cols-6 gap-1.5">
                    {FONT_SIZES.map((sz) => {
                      const active = sz === editorFontSize;
                      return (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => onChangeFontSize(sz)}
                          aria-pressed={active}
                          className="py-2 text-xs font-medium rounded-lg border tabular-nums transition-colors"
                          style={{
                            backgroundColor: active ? theme.ui.accent : theme.ui.surface,
                            borderColor: active ? theme.ui.accent : theme.ui.border,
                            color: active ? theme.ui.accentFg : theme.ui.text,
                          }}
                        >
                          {sz}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* BiDi Direction Control */}
            <section aria-labelledby="settings-bidi-heading" className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4" style={{ color: theme.ui.accent }} />
                  <h3 id="settings-bidi-heading" className="text-sm font-semibold">
                    Bidirectional (BiDi) Text Direction
                  </h3>
                </div>
                <span className="text-[11px]" style={{ color: theme.ui.textMuted }}>
                  Detected input script: {keyboardScript.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  {
                    id: 'auto' as DirectionMode,
                    title: 'Auto BiDi',
                    desc: 'LaTeX commands stay LTR; Persian/Arabic braces & prose render RTL automatically',
                  },
                  {
                    id: 'ltr' as DirectionMode,
                    title: 'Force LTR',
                    desc: 'Left-to-right base direction on every source line',
                  },
                  {
                    id: 'rtl' as DirectionMode,
                    title: 'Force RTL',
                    desc: 'Right-to-left base direction for Persian-first editing',
                  },
                ].map((opt) => {
                  const active = directionMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onChangeDirectionMode(opt.id)}
                      aria-pressed={active}
                      className="text-left p-3 rounded-lg border transition-colors"
                      style={{
                        backgroundColor: active ? theme.ui.surfaceAlt : theme.ui.surface,
                        borderColor: active ? theme.ui.accent : theme.ui.border,
                      }}
                    >
                      <div className="text-xs font-semibold">{opt.title}</div>
                      <p className="text-[11px] mt-1 leading-relaxed" style={{ color: theme.ui.textMuted }}>
                        {opt.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Live Code Typography & BiDi Sample */}
            <div
              className="rounded-lg border p-3.5 space-y-1.5"
              style={{
                backgroundColor: theme.editor.bg,
                borderColor: theme.ui.border,
                fontFamily: activeFont.cssFamily,
                fontSize: `${editorFontSize}px`,
              }}
            >
              <div dir="ltr" className="leading-relaxed">
                <span style={{ color: theme.editor.command }}>\section</span>
                <span style={{ color: theme.editor.brace }}>{'{'}</span>
                <bdi dir="rtl" style={{ color: theme.editor.rtlText, fontFamily: activeFont.rtlFamily }}>
                  درس اول: فضای هیلبرت
                </bdi>
                <span style={{ color: theme.editor.brace }}>{'}'}</span>
              </div>
              <div dir={directionMode === 'ltr' ? 'ltr' : 'rtl'} className="leading-relaxed">
                <bdi dir="rtl" style={{ color: theme.editor.rtlText, fontFamily: activeFont.rtlFamily }}>
                  نامساوی{' '}
                </bdi>
                <bdi dir="ltr" style={{ color: theme.editor.command }}>
                  \lr{'{'}Cauchy-Schwarz{'}'}
                </bdi>
                <bdi dir="rtl" style={{ color: theme.editor.rtlText, fontFamily: activeFont.rtlFamily }}>
                  {' '}در{' '}
                </bdi>
                <bdi dir="ltr" style={{ color: theme.editor.math }}>
                  $\langle u, v \rangle \leqslant \|u\|\|v\|$
                </bdi>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-5 overflow-y-auto space-y-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs" style={{ color: theme.ui.textMuted }}>
                Click any shortcut badge and press a new key combination (with Ctrl, Alt, Cmd, or F1–F12). Press Esc to cancel.
              </p>
              <button
                type="button"
                disabled={!hasCustomShortcuts}
                onClick={() => {
                  setRecordingAction(null);
                  onChangeShortcuts({ ...DEFAULT_SHORTCUTS });
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border shrink-0 disabled:opacity-45"
                style={{
                  borderColor: theme.ui.border,
                  backgroundColor: theme.ui.surface,
                  color: theme.ui.text,
                }}
              >
                <RotateCcw className="w-3 h-3" />
                Reset All
              </button>
            </div>

            {renderShortcutRows('Workspace')}
            {renderShortcutRows('LaTeX Editor')}
          </div>
        )}

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
