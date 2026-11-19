import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SHORTCUTS,
  findShortcutConflict,
  formatShortcutLabel,
  keyboardEventToBinding,
  matchesShortcutEvent,
  mergeShortcuts,
  normalizeBindingString,
} from './shortcuts';

test('mergeShortcuts preserves defaults and normalizes valid overrides', () => {
  const merged = mergeShortcuts({ compile: 'ctrl+shift+k', invalidAction: 'foo' });
  assert.equal(merged.compile, 'Ctrl-Shift-k');
  assert.equal(merged.saveFile, 'Mod-s');
  assert.equal(merged.toggleSidebar, DEFAULT_SHORTCUTS.toggleSidebar);
  assert.equal(normalizeBindingString('mod + shift + B'), 'Mod-Shift-b');
});

test('keyboardEventToBinding captures modified shortcuts and ignores bare typing or modifier keys', () => {
  assert.equal(
    keyboardEventToBinding({ key: 'Shift', ctrlKey: false, metaKey: false, altKey: false, shiftKey: true }),
    null
  );
  assert.equal(
    keyboardEventToBinding({ key: 'a', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }),
    null
  );
  assert.equal(
    keyboardEventToBinding({ key: 'Enter', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }),
    'Mod-Enter'
  );
  assert.equal(
    keyboardEventToBinding({ key: ' ', code: 'Space', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }),
    'Ctrl-Space'
  );
  assert.equal(
    keyboardEventToBinding({ key: 'F5', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }),
    'F5'
  );
});

test('matchesShortcutEvent matches normalized bindings cleanly', () => {
  assert.equal(
    matchesShortcutEvent(
      { key: 'Enter', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false },
      'Mod-Enter'
    ),
    true
  );
  assert.equal(
    matchesShortcutEvent(
      { key: 'B', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true },
      'Mod-Shift-b'
    ),
    true
  );
  assert.equal(
    matchesShortcutEvent(
      { key: 'b', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false },
      'Mod-Shift-b'
    ),
    false
  );
});

test('formatShortcutLabel and findShortcutConflict format keycaps and detect duplicates', () => {
  assert.deepEqual(formatShortcutLabel('Mod-Shift-b', false), ['Ctrl', 'Shift', 'B']);
  assert.deepEqual(formatShortcutLabel('Mod-Enter', true), ['⌘', 'Enter']);
  assert.equal(findShortcutConflict(DEFAULT_SHORTCUTS, 'toggleSidebar', 'Mod-Enter'), 'compile');
  assert.equal(findShortcutConflict(DEFAULT_SHORTCUTS, 'compile', 'Mod-Enter'), null);
});
