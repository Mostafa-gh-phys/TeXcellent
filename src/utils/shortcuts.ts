import { ShortcutActionId, ShortcutMap } from '../types/latex';

export interface ShortcutDefinition {
  id: ShortcutActionId;
  label: string;
  description: string;
  category: 'Workspace' | 'LaTeX Editor';
  defaultBinding: string;
}

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  {
    id: 'compile',
    label: 'Compile PDF',
    description: 'Build the active LaTeX document and refresh the PDF preview',
    category: 'Workspace',
    defaultBinding: 'Mod-Enter',
  },
  {
    id: 'saveFile',
    label: 'Save Active File',
    description: 'Save or export the current document and clear unsaved state',
    category: 'Workspace',
    defaultBinding: 'Mod-s',
  },
  {
    id: 'togglePreview',
    label: 'Toggle Preview Pane',
    description: 'Switch between Beside PDF view and Editor-only view',
    category: 'Workspace',
    defaultBinding: 'Mod-\\',
  },
  {
    id: 'toggleSidebar',
    label: 'Toggle Project Sidebar',
    description: 'Show or hide the multi-project folder tree',
    category: 'Workspace',
    defaultBinding: 'Mod-b',
  },
  {
    id: 'toggleLog',
    label: 'Toggle Log & Bugs Drawer',
    description: 'Open or collapse the compiler diagnostics and log panel',
    category: 'Workspace',
    defaultBinding: 'Mod-j',
  },
  {
    id: 'openFiles',
    label: 'Open File & Project Manager',
    description: 'Open modal for new files, templates, ZIP/folder import, and export',
    category: 'Workspace',
    defaultBinding: 'Mod-o',
  },
  {
    id: 'openSettings',
    label: 'Open Editor Settings',
    description: 'Open theme, font, BiDi, and shortcut preferences',
    category: 'Workspace',
    defaultBinding: 'Mod-,',
  },
  {
    id: 'triggerAutocomplete',
    label: 'Trigger Autocomplete',
    description: 'Open LaTeX commands, package options, snippets, and citation suggestions',
    category: 'LaTeX Editor',
    defaultBinding: 'Ctrl-Space',
  },
  {
    id: 'insertBold',
    label: 'Bold (\\textbf)',
    description: 'Wrap selection or insert \\textbf{} at cursor',
    category: 'LaTeX Editor',
    defaultBinding: 'Mod-Shift-b',
  },
  {
    id: 'insertItalic',
    label: 'Italic (\\textit)',
    description: 'Wrap selection or insert \\textit{} at cursor',
    category: 'LaTeX Editor',
    defaultBinding: 'Mod-Shift-i',
  },
  {
    id: 'insertMath',
    label: 'Inline Math ($...$)',
    description: 'Wrap selection or insert inline $...$ delimiters',
    category: 'LaTeX Editor',
    defaultBinding: 'Mod-Shift-m',
  },
];

export const DEFAULT_SHORTCUTS: ShortcutMap = SHORTCUT_DEFINITIONS.reduce((acc, item) => {
  acc[item.id] = item.defaultBinding;
  return acc;
}, {} as ShortcutMap);

export function mergeShortcuts(partial?: Partial<Record<string, unknown>> | null): ShortcutMap {
  const next: ShortcutMap = { ...DEFAULT_SHORTCUTS };
  if (!partial || typeof partial !== 'object') return next;
  for (const def of SHORTCUT_DEFINITIONS) {
    const val = partial[def.id];
    if (typeof val === 'string' && val.trim().length > 0) {
      next[def.id] = normalizeBindingString(val);
    }
  }
  return next;
}

const SPECIAL_KEY_MAP: Record<string, string> = {
  ' ': 'Space',
  Spacebar: 'Space',
  Enter: 'Enter',
  Return: 'Enter',
  Escape: 'Escape',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
};

function normalizeKeyToken(rawKey: string): string {
  if (!rawKey) return '';
  if (SPECIAL_KEY_MAP[rawKey]) return SPECIAL_KEY_MAP[rawKey];
  if (/^F([1-9]|1[0-2])$/i.test(rawKey)) return rawKey.toUpperCase();
  if (rawKey.length === 1) return rawKey.toLowerCase();
  return rawKey;
}

export function normalizeBindingString(binding: string): string {
  const parts = binding
    .split(/[-+]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return '';

  const keyToken = normalizeKeyToken(parts[parts.length - 1]);
  const modSet = new Set<string>();
  for (const part of parts.slice(0, -1)) {
    const lower = part.toLowerCase();
    if (lower === 'mod' || lower === 'cmd' || lower === 'meta') modSet.add('Mod');
    else if (lower === 'ctrl' || lower === 'control') modSet.add('Ctrl');
    else if (lower === 'alt' || lower === 'option') modSet.add('Alt');
    else if (lower === 'shift') modSet.add('Shift');
  }

  const orderedMods: string[] = [];
  if (modSet.has('Mod')) orderedMods.push('Mod');
  if (modSet.has('Ctrl')) orderedMods.push('Ctrl');
  if (modSet.has('Alt')) orderedMods.push('Alt');
  if (modSet.has('Shift')) orderedMods.push('Shift');
  return [...orderedMods, keyToken].join('-');
}

export interface KeyEventLike {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

const MODIFIER_ONLY_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'OS', 'CapsLock']);

export function keyboardEventToBinding(e: KeyEventLike): string | null {
  if (!e.key || MODIFIER_ONLY_KEYS.has(e.key)) return null;

  let normalizedKey = normalizeKeyToken(e.key);
  if (e.code === 'Space') normalizedKey = 'Space';

  const isFunctionKey = /^F([1-9]|1[0-2])$/.test(normalizedKey);
  const hasModifier = e.ctrlKey || e.metaKey || e.altKey;

  // Require at least one non-Shift modifier (or a function key F1..F12) so normal typing isn't captured
  if (!hasModifier && !isFunctionKey) {
    return null;
  }

  const mods: string[] = [];
  if (e.metaKey) {
    mods.push('Mod');
    if (e.ctrlKey) mods.push('Ctrl');
  } else if (e.ctrlKey) {
    // Use Ctrl-Space explicitly so CodeMirror Ctrl-Space works cross-platform; Mod-* otherwise
    mods.push(normalizedKey === 'Space' && !e.altKey && !e.shiftKey ? 'Ctrl' : 'Mod');
  }
  if (e.altKey) mods.push('Alt');
  if (e.shiftKey) mods.push('Shift');

  return [...mods, normalizedKey].join('-');
}

export function matchesShortcutEvent(e: KeyEventLike, binding: string, isMac = false): boolean {
  if (!binding) return false;
  const normalized = normalizeBindingString(binding);
  const parts = normalized.split('-');
  const expectedKey = parts[parts.length - 1];
  const mods = new Set(parts.slice(0, -1));

  const wantMod = mods.has('Mod');
  const wantCtrl = mods.has('Ctrl');
  const wantAlt = mods.has('Alt');
  const wantShift = mods.has('Shift');

  const actualPrimaryMod = isMac ? e.metaKey : e.ctrlKey;
  if (wantMod) {
    if (!(actualPrimaryMod || e.metaKey || e.ctrlKey)) return false;
  } else if (wantCtrl) {
    if (!e.ctrlKey || e.metaKey) return false;
  } else if (e.ctrlKey || e.metaKey) {
    return false;
  }

  if (wantAlt !== e.altKey) return false;
  if (wantShift !== e.shiftKey) return false;

  let actualKey = normalizeKeyToken(e.key);
  if (e.code === 'Space') actualKey = 'Space';
  return actualKey === expectedKey;
}

export function formatShortcutLabel(binding: string, isMac = false): string[] {
  if (!binding) return [];
  const normalized = normalizeBindingString(binding);
  return normalized.split('-').map((part) => {
    if (part === 'Mod') return isMac ? '⌘' : 'Ctrl';
    if (part === 'Ctrl') return isMac ? '⌃' : 'Ctrl';
    if (part === 'Alt') return isMac ? '⌥' : 'Alt';
    if (part === 'Shift') return isMac ? '⇧' : 'Shift';
    if (part === 'Space') return 'Space';
    if (part === 'Enter') return 'Enter';
    if (part.length === 1) return part.toUpperCase();
    return part;
  });
}

export function findShortcutConflict(
  shortcuts: ShortcutMap,
  actionId: ShortcutActionId,
  candidateBinding: string
): ShortcutActionId | null {
  const target = normalizeBindingString(candidateBinding);
  if (!target) return null;
  for (const def of SHORTCUT_DEFINITIONS) {
    if (def.id === actionId) continue;
    if (normalizeBindingString(shortcuts[def.id]) === target) {
      return def.id;
    }
  }
  return null;
}
