import { EditorFontId } from '../types/latex';

export interface EditorFontOption {
  id: EditorFontId;
  name: string;
  cssFamily: string;
  rtlFamily: string;
}

export const EDITOR_FONTS: Record<EditorFontId, EditorFontOption> = {
  jetbrains: {
    id: 'jetbrains',
    name: 'JetBrains Mono',
    cssFamily: "'JetBrains Mono', 'Vazirmatn', ui-monospace, monospace",
    rtlFamily: "'Vazirmatn', 'JetBrains Mono', monospace",
  },
  'ibm-plex': {
    id: 'ibm-plex',
    name: 'IBM Plex Mono',
    cssFamily: "'IBM Plex Mono', 'Vazirmatn', ui-monospace, monospace",
    rtlFamily: "'Vazirmatn', 'IBM Plex Mono', monospace",
  },
  'fira-code': {
    id: 'fira-code',
    name: 'Fira Code',
    cssFamily: "'Fira Code', 'Vazirmatn', ui-monospace, monospace",
    rtlFamily: "'Vazirmatn', 'Fira Code', monospace",
  },
  'source-code': {
    id: 'source-code',
    name: 'Source Code Pro',
    cssFamily: "'Source Code Pro', 'Vazirmatn', ui-monospace, monospace",
    rtlFamily: "'Vazirmatn', 'Source Code Pro', monospace",
  },
  vazirmatn: {
    id: 'vazirmatn',
    name: 'Vazirmatn (RTL Focus)',
    cssFamily: "'Vazirmatn', 'JetBrains Mono', sans-serif",
    rtlFamily: "'Vazirmatn', sans-serif",
  },
  'system-mono': {
    id: 'system-mono',
    name: 'System Monospace',
    cssFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Vazirmatn', monospace",
    rtlFamily: "'Vazirmatn', ui-monospace, monospace",
  },
};

export const EDITOR_FONT_LIST: EditorFontOption[] = Object.values(EDITOR_FONTS);
