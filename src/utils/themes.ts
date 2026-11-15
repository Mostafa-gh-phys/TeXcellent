import { ThemeId } from '../types/latex';

export interface EditorTheme {
  id: ThemeId;
  name: string;
  description: string;
  isDark: boolean;
  ui: {
    bg: string;
    surface: string;
    surfaceAlt: string;
    border: string;
    text: string;
    textMuted: string;
    accent: string;
    accentHover: string;
    accentFg: string;
  };
  editor: {
    bg: string;
    fg: string;
    gutterBg: string;
    gutterFg: string;
    activeLineBg: string;
    selectionBg: string;
    cursor: string;
    command: string;
    brace: string;
    math: string;
    environment: string;
    comment: string;
    argument: string;
    rtlText: string;
    number: string;
  };
}

export const EDITOR_THEMES: Record<ThemeId, EditorTheme> = {
  'github-light': {
    id: 'github-light',
    name: 'GitHub Light',
    description: 'Clean daylight palette with crisp crimson commands & sapphire math',
    isDark: false,
    ui: {
      bg: '#ffffff',
      surface: '#f6f8fa',
      surfaceAlt: '#eef2f6',
      border: '#d0d7de',
      text: '#1f2328',
      textMuted: '#656d76',
      accent: '#0969da',
      accentHover: '#0550ae',
      accentFg: '#ffffff',
    },
    editor: {
      bg: '#ffffff',
      fg: '#1f2328',
      gutterBg: '#ffffff',
      gutterFg: '#8c959f',
      activeLineBg: '#f6f8fa',
      selectionBg: '#ddf4ff',
      cursor: '#0969da',
      command: '#cf222e',
      brace: '#953800',
      math: '#0550ae',
      environment: '#116329',
      comment: '#6e7781',
      argument: '#0a3069',
      rtlText: '#1f2328',
      number: '#0550ae',
    },
  },
  'github-dark': {
    id: 'github-dark',
    name: 'GitHub Dark',
    description: 'High-contrast charcoal canvas with coral commands & sky math',
    isDark: true,
    ui: {
      bg: '#0d1117',
      surface: '#161b22',
      surfaceAlt: '#21262d',
      border: '#30363d',
      text: '#e6edf3',
      textMuted: '#8b949e',
      accent: '#2f81f7',
      accentHover: '#58a6ff',
      accentFg: '#ffffff',
    },
    editor: {
      bg: '#0d1117',
      fg: '#e6edf3',
      gutterBg: '#0d1117',
      gutterFg: '#6e7681',
      activeLineBg: '#161b22',
      selectionBg: '#1f3a5f',
      cursor: '#58a6ff',
      command: '#ff7b72',
      brace: '#ffa657',
      math: '#79c0ff',
      environment: '#7ee787',
      comment: '#8b949e',
      argument: '#a5d6ff',
      rtlText: '#f0f6fc',
      number: '#79c0ff',
    },
  },
  mathematica: {
    id: 'mathematica',
    name: 'Mathematica Notebook',
    description: 'Warm archival vellum inspired by Wolfram notebook cells',
    isDark: false,
    ui: {
      bg: '#fcfaf5',
      surface: '#f5f1e8',
      surfaceAlt: '#ebe5d8',
      border: '#dcd3c1',
      text: '#221f1a',
      textMuted: '#6f685c',
      accent: '#b43c00',
      accentHover: '#8f2f00',
      accentFg: '#ffffff',
    },
    editor: {
      bg: '#fdfcf8',
      fg: '#221f1a',
      gutterBg: '#f8f4eb',
      gutterFg: '#968d7d',
      activeLineBg: '#f3ede0',
      selectionBg: '#fce8d5',
      cursor: '#b43c00',
      command: '#9e2b0e',
      brace: '#6b4c1e',
      math: '#004f9e',
      environment: '#1f6f50',
      comment: '#837b6c',
      argument: '#4c2c72',
      rtlText: '#1c1914',
      number: '#004f9e',
    },
  },
  nord: {
    id: 'nord',
    name: 'Nord Polar',
    description: 'Arctic slate tones with frost-blue commands & aurora accents',
    isDark: true,
    ui: {
      bg: '#2e3440',
      surface: '#3b4252',
      surfaceAlt: '#434c5e',
      border: '#4c566a',
      text: '#eceff4',
      textMuted: '#a5b1c2',
      accent: '#88c0d0',
      accentHover: '#8fbcbb',
      accentFg: '#2e3440',
    },
    editor: {
      bg: '#2e3440',
      fg: '#eceff4',
      gutterBg: '#2e3440',
      gutterFg: '#616e88',
      activeLineBg: '#3b4252',
      selectionBg: '#434c5e',
      cursor: '#88c0d0',
      command: '#81a1c1',
      brace: '#d08770',
      math: '#ebcb8b',
      environment: '#a3be8c',
      comment: '#7b88a1',
      argument: '#88c0d0',
      rtlText: '#eceff4',
      number: '#b48ead',
    },
  },
  'solarized-light': {
    id: 'solarized-light',
    name: 'Solarized Paper',
    description: 'Low-glare warm parchment engineered for extended reading',
    isDark: false,
    ui: {
      bg: '#fdf6e3',
      surface: '#eee8d5',
      surfaceAlt: '#e4ddc8',
      border: '#d6ceb8',
      text: '#073642',
      textMuted: '#586e75',
      accent: '#268bd2',
      accentHover: '#1d73b0',
      accentFg: '#fdf6e3',
    },
    editor: {
      bg: '#fdf6e3',
      fg: '#586e75',
      gutterBg: '#f6efdc',
      gutterFg: '#93a1a1',
      activeLineBg: '#eee8d5',
      selectionBg: '#e1dac4',
      cursor: '#dc322f',
      command: '#268bd2',
      brace: '#cb4b16',
      math: '#d33682',
      environment: '#859900',
      comment: '#93a1a1',
      argument: '#2aa198',
      rtlText: '#073642',
      number: '#6c71c4',
    },
  },
  'tokyo-night': {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    description: 'Deep indigo ink with luminous cobalt & sage syntax highlights',
    isDark: true,
    ui: {
      bg: '#1a1b26',
      surface: '#24283b',
      surfaceAlt: '#2f3549',
      border: '#3b4261',
      text: '#c0caf5',
      textMuted: '#7a88cf',
      accent: '#7aa2f7',
      accentHover: '#89b4fa',
      accentFg: '#1a1b26',
    },
    editor: {
      bg: '#1a1b26',
      fg: '#c0caf5',
      gutterBg: '#1a1b26',
      gutterFg: '#565f89',
      activeLineBg: '#24283b',
      selectionBg: '#33467c',
      cursor: '#7aa2f7',
      command: '#7aa2f7',
      brace: '#ff9e64',
      math: '#bb9af7',
      environment: '#9ece6a',
      comment: '#565f89',
      argument: '#73daca',
      rtlText: '#c0caf5',
      number: '#ff9e64',
    },
  },
  monokai: {
    id: 'monokai',
    name: 'Monokai Pro',
    description: 'Warm graphite surface with ruby commands & amber math delimiters',
    isDark: true,
    ui: {
      bg: '#2d2a2e',
      surface: '#373339',
      surfaceAlt: '#433e45',
      border: '#524c54',
      text: '#fcfcfa',
      textMuted: '#939293',
      accent: '#ffd866',
      accentHover: '#ffe184',
      accentFg: '#2d2a2e',
    },
    editor: {
      bg: '#2d2a2e',
      fg: '#fcfcfa',
      gutterBg: '#2d2a2e',
      gutterFg: '#727072',
      activeLineBg: '#373339',
      selectionBg: '#4c464f',
      cursor: '#ffd866',
      command: '#ff6188',
      brace: '#fc9867',
      math: '#ffd866',
      environment: '#a9dc76',
      comment: '#727072',
      argument: '#78dce8',
      rtlText: '#fcfcfa',
      number: '#ab9df2',
    },
  },
};

export const THEME_LIST: EditorTheme[] = Object.values(EDITOR_THEMES);
