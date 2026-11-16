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
  'roboto-mono': {
    id: 'roboto-mono',
    name: 'Roboto Mono',
    cssFamily: "'Roboto Mono', 'Vazirmatn', ui-monospace, monospace",
    rtlFamily: "'Vazirmatn', 'Roboto Mono', monospace",
  },
  inconsolata: {
    id: 'inconsolata',
    name: 'Inconsolata',
    cssFamily: "'Inconsolata', 'Vazirmatn', ui-monospace, monospace",
    rtlFamily: "'Vazirmatn', 'Inconsolata', monospace",
  },
  'ubuntu-mono': {
    id: 'ubuntu-mono',
    name: 'Ubuntu Mono',
    cssFamily: "'Ubuntu Mono', 'Vazirmatn', ui-monospace, monospace",
    rtlFamily: "'Vazirmatn', 'Ubuntu Mono', monospace",
  },
  'space-mono': {
    id: 'space-mono',
    name: 'Space Mono',
    cssFamily: "'Space Mono', 'Vazirmatn', ui-monospace, monospace",
    rtlFamily: "'Vazirmatn', 'Space Mono', monospace",
  },
  'noto-sans-mono': {
    id: 'noto-sans-mono',
    name: 'Noto Sans Mono',
    cssFamily: "'Noto Sans Mono', 'Vazirmatn', ui-monospace, monospace",
    rtlFamily: "'Vazirmatn', 'Noto Sans Mono', monospace",
  },
  vazirmatn: {
    id: 'vazirmatn',
    name: 'Vazirmatn (RTL Focus)',
    cssFamily: "'Vazirmatn', 'JetBrains Mono', sans-serif",
    rtlFamily: "'Vazirmatn', sans-serif",
  },
  'noto-naskh': {
    id: 'noto-naskh',
    name: 'Noto Naskh Arabic (RTL Editorial)',
    cssFamily: "'JetBrains Mono', 'Noto Naskh Arabic', monospace",
    rtlFamily: "'Noto Naskh Arabic', 'Vazirmatn', serif",
  },
  'system-mono': {
    id: 'system-mono',
    name: 'System Monospace',
    cssFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Vazirmatn', monospace",
    rtlFamily: "'Vazirmatn', ui-monospace, monospace",
  },
};

export const EDITOR_FONT_LIST: EditorFontOption[] = Object.values(EDITOR_FONTS);
