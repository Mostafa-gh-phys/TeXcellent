import React from 'react';
import { X, Palette, Type, ArrowLeftRight, Check } from 'lucide-react';
import { DirectionMode, EditorFontId, ThemeId } from '../types/latex';
import { EditorTheme, THEME_LIST } from '../utils/themes';
import { EDITOR_FONT_LIST, EDITOR_FONTS } from '../utils/editorFonts';

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
}) => {
  if (!isOpen) return null;

  const activeFont = EDITOR_FONTS[editorFontId] || EDITOR_FONTS.jetbrains;

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
          className="flex items-center justify-between px-5 py-3.5 border-b"
          style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.surface }}
        >
          <div>
            <h2 className="text-base font-semibold">Editor Settings &amp; BiDi</h2>
            <p className="text-xs" style={{ color: theme.ui.textMuted }}>
              Configure editor color theme, typography, font size, and bidirectional text behavior
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
                    className="text-left p-3 rounded-lg border transition-colors flex items-start justify-between gap-3"
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
