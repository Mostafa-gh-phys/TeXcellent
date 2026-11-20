import React, { useEffect, useRef } from 'react';
import {
  Annotation,
  EditorState,
  Compartment,
  RangeSetBuilder,
} from '@codemirror/state';
import {
  EditorView,
  Decoration,
  DecorationSet,
  Direction,
  KeyBinding,
  ViewPlugin,
  ViewUpdate,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  autocompletion,
  CompletionContext,
  CompletionResult,
  startCompletion,
} from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { DirectionMode, ProjectFile, ShortcutActionId, ShortcutMap } from '../types/latex';
import { EditorTheme } from '../utils/themes';
import { EditorFontOption } from '../utils/editorFonts';
import { DEFAULT_SHORTCUTS } from '../utils/shortcuts';
import {
  computeBidiSpans,
  detectInputScript,
  detectLineDirection,
  tokenizeLatexLine,
} from '../utils/bidiLatex';
import { getLatexSuggestions } from '../utils/latexAutocomplete';

const externalSyncAnnotation = Annotation.define<boolean>();

type WorkspaceShortcutAction = Extract<
  ShortcutActionId,
  | 'compile'
  | 'saveFile'
  | 'togglePreview'
  | 'toggleSidebar'
  | 'toggleLog'
  | 'openFiles'
  | 'openSettings'
  | 'forwardSync'
>;

interface LatexCodeEditorProps {
  value: string;
  onChange: (nextValue: string) => void;
  theme: EditorTheme;
  editorFont: EditorFontOption;
  editorFontSize: number;
  directionMode: DirectionMode;
  files: ProjectFile[];
  shortcuts?: ShortcutMap;
  onTriggerWorkspaceShortcut?: (action: WorkspaceShortcutAction) => void;
  onCursorInfo?: (info: { line: number; col: number; detectedDir: 'ltr' | 'rtl' }) => void;
  onScriptDetected?: (script: 'ltr' | 'rtl') => void;
  editorRefOut?: React.MutableRefObject<{
    insertAtCursor: (snippet: string) => void;
    jumpToLine?: (lineNumber: number) => void;
    getCurrentLine?: () => number;
  } | null>;
}

interface CachedLineAnalysis {
  dir: 'ltr' | 'rtl';
  bidiSpans: ReturnType<typeof computeBidiSpans>;
  tokens: ReturnType<typeof tokenizeLatexLine>;
}

const MAX_LINE_ANALYSIS_CACHE = 1500;
const lineAnalysisCache = new Map<string, CachedLineAnalysis>();

function getCachedLineAnalysis(text: string, directionMode: DirectionMode): CachedLineAnalysis {
  const key = `${directionMode}\0${text}`;
  const existing = lineAnalysisCache.get(key);
  if (existing) {
    // Refresh LRU order
    lineAnalysisCache.delete(key);
    lineAnalysisCache.set(key, existing);
    return existing;
  }
  const dir = detectLineDirection(text, directionMode);
  const computed: CachedLineAnalysis = {
    dir,
    bidiSpans: computeBidiSpans(text, dir),
    tokens: tokenizeLatexLine(text),
  };
  if (lineAnalysisCache.size >= MAX_LINE_ANALYSIS_CACHE) {
    const oldestKey = lineAnalysisCache.keys().next().value;
    if (oldestKey !== undefined) lineAnalysisCache.delete(oldestKey);
  }
  lineAnalysisCache.set(key, computed);
  return computed;
}

function buildBidiDecorations(
  view: EditorView,
  theme: EditorTheme,
  directionMode: DirectionMode
): { decorations: DecorationSet; bidiIsolates: DecorationSet } {
  const decoBuilder = new RangeSetBuilder<Decoration>();
  const isolateBuilder = new RangeSetBuilder<Decoration>();

  type Combined = { kind: 'line' | 'isolate' | 'token'; from: number; to: number; deco: Decoration };
  const allDecos: Combined[] = [];
  const allIsolates: Array<{ from: number; to: number; deco: Decoration }> = [];

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      const { dir, bidiSpans, tokens } = getCachedLineAnalysis(line.text, directionMode);
      allDecos.push({
        kind: 'line',
        from: line.from,
        to: line.from,
        deco: Decoration.line({ attributes: { dir } }),
      });

      // 1. Official CodeMirror BiDi isolation ranges (rendered in DOM AND fed to bidiIsolatedRanges)
      for (const span of bidiSpans) {
        if (span.from >= span.to) continue;
        const isoDeco = Decoration.mark({
          bidiIsolate: span.dir === 'ltr' ? Direction.LTR : Direction.RTL,
          class: span.dir === 'ltr' ? 'cm-bidi-isolate-ltr' : 'cm-bidi-isolate-rtl',
          attributes: { dir: span.dir },
        });
        allDecos.push({
          kind: 'isolate',
          from: line.from + span.from,
          to: line.from + span.to,
          deco: isoDeco,
        });
        allIsolates.push({
          from: line.from + span.from,
          to: line.from + span.to,
          deco: isoDeco,
        });
      }

      // 2. Syntax color tokens (pure styling, no CSS unicode-bidi interference)
      for (const tok of tokens) {
        if (tok.from >= tok.to || tok.type === 'whitespace') continue;
        let color = theme.editor.fg;
        let fontWeight = '400';
        let fontStyle = 'normal';

        switch (tok.type) {
          case 'command':
            color = theme.editor.command;
            fontWeight = '500';
            break;
          case 'environment':
            color = theme.editor.environment;
            fontWeight = '600';
            break;
          case 'brace':
            color = theme.editor.brace;
            break;
          case 'math':
            color = theme.editor.math;
            break;
          case 'comment':
            color = theme.editor.comment;
            fontStyle = 'italic';
            break;
          case 'rtl-text':
            color = theme.editor.rtlText;
            break;
          default:
            color = theme.editor.fg;
        }

        allDecos.push({
          kind: 'token',
          from: line.from + tok.from,
          to: line.from + tok.to,
          deco: Decoration.mark({
            attributes: {
              style: `color: ${color}; font-weight: ${fontWeight}; font-style: ${fontStyle};`,
            },
          }),
        });
      }

      if (line.to >= to) break;
      pos = line.to + 1;
    }
  }

  const order = { line: 0, isolate: 1, token: 2 };
  allDecos.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    if (order[a.kind] !== order[b.kind]) return order[a.kind] - order[b.kind];
    return b.to - a.to;
  });
  for (const item of allDecos) {
    decoBuilder.add(item.from, item.to, item.deco);
  }

  allIsolates.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    return b.to - a.to;
  });
  for (const iso of allIsolates) {
    isolateBuilder.add(iso.from, iso.to, iso.deco);
  }

  return {
    decorations: decoBuilder.finish(),
    bidiIsolates: isolateBuilder.finish(),
  };
}

function createEditorThemeExtension(theme: EditorTheme, font: EditorFontOption, fontSize: number) {
  return EditorView.theme(
    {
      '&': {
        backgroundColor: theme.editor.bg,
        color: theme.editor.fg,
        fontSize: `${fontSize}px`,
        fontFamily: font.cssFamily,
      },
      '.cm-scroller': {
        fontFamily: font.cssFamily,
      },
      '.cm-content': {
        caretColor: theme.editor.cursor,
        paddingTop: '14px',
        paddingBottom: '40px',
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: theme.editor.cursor,
        borderLeftWidth: '2px',
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: `${theme.editor.selectionBg} !important`,
      },
      '.cm-activeLine': {
        backgroundColor: theme.editor.activeLineBg,
      },
      '.cm-gutters': {
        backgroundColor: theme.editor.gutterBg,
        color: theme.editor.gutterFg,
        borderRight: `1px solid ${theme.ui.border}`,
        minWidth: '46px',
      },
      '.cm-activeLineGutter': {
        backgroundColor: theme.editor.activeLineBg,
        color: theme.ui.text,
      },
      '.cm-tooltip.cm-tooltip-autocomplete': {
        backgroundColor: theme.ui.surface,
        border: `1px solid ${theme.ui.border}`,
        color: theme.ui.text,
      },
      '.cm-tooltip-autocomplete ul li[aria-selected]': {
        backgroundColor: theme.ui.accent,
        color: theme.ui.accentFg,
      },
      '.cm-completionDetail': {
        color: theme.ui.textMuted,
        marginLeft: '10px',
        fontSize: '11.5px',
      },
      '.cm-tooltip-autocomplete ul li[aria-selected] .cm-completionDetail': {
        color: theme.ui.accentFg,
        opacity: '0.88',
      },
    },
    { dark: theme.isDark }
  );
}

export const LatexCodeEditor: React.FC<LatexCodeEditorProps> = ({
  value,
  onChange,
  theme,
  editorFont,
  editorFontSize,
  directionMode,
  files,
  shortcuts = DEFAULT_SHORTCUTS,
  onTriggerWorkspaceShortcut,
  onCursorInfo,
  onScriptDetected,
  editorRefOut,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  const themeCompRef = useRef(new Compartment());
  const pluginCompRef = useRef(new Compartment());
  const keymapCompRef = useRef(new Compartment());

  const latestProps = useRef({
    onChange,
    theme,
    editorFont,
    editorFontSize,
    directionMode,
    files,
    shortcuts,
    onTriggerWorkspaceShortcut,
    onCursorInfo,
    onScriptDetected,
  });
  latestProps.current = {
    onChange,
    theme,
    editorFont,
    editorFontSize,
    directionMode,
    files,
    shortcuts,
    onTriggerWorkspaceShortcut,
    onCursorInfo,
    onScriptDetected,
  };

  const wrapSelectionWith = (view: EditorView, prefix: string, suffix: string) => {
    const sel = view.state.selection.main;
    const selectedText = view.state.sliceDoc(sel.from, sel.to);
    const insert = `${prefix}${selectedText}${suffix}`;
    const anchor = selectedText
      ? sel.from + insert.length
      : sel.from + prefix.length;
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert },
      selection: { anchor },
    });
    return true;
  };

  const makeKeymapExtension = (map: ShortcutMap) => {
    const workspaceActions: WorkspaceShortcutAction[] = [
      'compile',
      'saveFile',
      'togglePreview',
      'toggleSidebar',
      'toggleLog',
      'openFiles',
      'openSettings',
      'forwardSync',
    ];
    const customBindings: KeyBinding[] = [];
    for (const actionId of workspaceActions) {
      const key = map[actionId];
      if (key) {
        customBindings.push({
          key,
          run: () => {
            latestProps.current.onTriggerWorkspaceShortcut?.(actionId);
            return true;
          },
        });
      }
    }
    if (map.triggerAutocomplete) {
      customBindings.push({
        key: map.triggerAutocomplete,
        run: startCompletion,
      });
    }
    if (map.insertBold) {
      customBindings.push({
        key: map.insertBold,
        run: (view) => wrapSelectionWith(view, '\\textbf{', '}'),
      });
    }
    if (map.insertItalic) {
      customBindings.push({
        key: map.insertItalic,
        run: (view) => wrapSelectionWith(view, '\\textit{', '}'),
      });
    }
    if (map.insertMath) {
      customBindings.push({
        key: map.insertMath,
        run: (view) => wrapSelectionWith(view, '$', '$'),
      });
    }

    return keymap.of([
      ...customBindings,
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      indentWithTab,
    ]);
  };

  const makeBidiPlugin = (t: EditorTheme, dirMode: DirectionMode) =>
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;
        bidiIsolates: DecorationSet;
        constructor(view: EditorView) {
          const built = buildBidiDecorations(view, t, dirMode);
          this.decorations = built.decorations;
          this.bidiIsolates = built.bidiIsolates;
        }
        update(update: ViewUpdate) {
          if (update.docChanged || update.viewportChanged) {
            const built = buildBidiDecorations(update.view, t, dirMode);
            this.decorations = built.decorations;
            this.bidiIsolates = built.bidiIsolates;
          }
        }
      },
      {
        decorations: (v) => v.decorations,
        provide: (plugin) =>
          EditorView.bidiIsolatedRanges.of(
            (view) => view.plugin(plugin)?.bidiIsolates ?? Decoration.none
          ),
      }
    );

  useEffect(() => {
    if (!containerRef.current) return;

    const latexCompletionSource = (context: CompletionContext): CompletionResult | null => {
      const doc = context.state.doc.toString();
      const res = getLatexSuggestions(doc, context.pos, latestProps.current.files);
      if (!res) return null;
      return {
        from: res.from,
        to: res.to,
        validFor: /^[\\a-zA-Z0-9_:=.!@-]*$/,
        options: res.items.map((item) => ({
          label: item.label,
          detail: item.detail,
          type:
            item.kind === 'environment'
              ? 'class'
              : item.kind === 'package'
                ? 'namespace'
                : item.kind === 'option'
                  ? 'property'
                  : item.kind === 'snippet'
                    ? 'keyword'
                    : 'function',
          apply: (view, _completion, from, to) => {
            const insert = item.insertText;
            const bracePos = item.kind === 'snippet' ? -1 : insert.indexOf('{}');
            view.dispatch({
              changes: { from, to, insert },
              selection: {
                anchor: bracePos !== -1 ? from + bracePos + 1 : from + insert.length,
              },
            });
          },
        })),
      };
    };

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        history(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        highlightSelectionMatches(),
        EditorView.lineWrapping,
        EditorView.perLineTextDirection.of(true),
        autocompletion({
          override: [latexCompletionSource],
          activateOnTyping: true,
          maxRenderedOptions: 14,
        }),
        keymapCompRef.current.of(makeKeymapExtension(shortcuts)),
        themeCompRef.current.of(
          createEditorThemeExtension(theme, editorFont, editorFontSize)
        ),
        pluginCompRef.current.of(makeBidiPlugin(theme, directionMode)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const isExternalOnly = update.transactions.every((tr) =>
              Boolean(tr.annotation(externalSyncAnnotation))
            );
            if (isExternalOnly) return;

            const nextDoc = update.state.doc.toString();
            latestProps.current.onChange(nextDoc);

            let typedTriggerChar = false;
            update.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
              const insertedText = inserted.toString();
              if (insertedText === '[' || insertedText === ',' || insertedText === '{' || insertedText === '\\') {
                typedTriggerChar = true;
              }
              const script = detectInputScript(insertedText);
              if (script) {
                latestProps.current.onScriptDetected?.(script);
              }
            });

            // CodeMirror only auto-opens on word chars; trigger immediately for [, {, ,, \ contexts
            if (typedTriggerChar) {
              const head = update.state.selection.main.head;
              if (getLatexSuggestions(nextDoc, head, latestProps.current.files)) {
                requestAnimationFrame(() => startCompletion(update.view));
              }
            }
          }

          if (update.selectionSet || update.docChanged) {
            const head = update.state.selection.main.head;
            const lineObj = update.state.doc.lineAt(head);
            const col = head - lineObj.from + 1;
            const detectedDir = detectLineDirection(
              lineObj.text,
              latestProps.current.directionMode
            );
            latestProps.current.onCursorInfo?.({
              line: lineObj.number,
              col,
              detectedDir,
            });
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });
    viewRef.current = view;

    if (editorRefOut) {
      editorRefOut.current = {
        insertAtCursor: (snippet: string) => {
          const sel = view.state.selection.main;
          view.dispatch({
            changes: { from: sel.from, to: sel.to, insert: snippet },
            selection: { anchor: sel.from + snippet.length },
          });
          view.focus();
        },
        jumpToLine: (lineNumber: number) => {
          const clamped = Math.max(1, Math.min(view.state.doc.lines, lineNumber));
          const line = view.state.doc.line(clamped);
          view.dispatch({
            selection: { anchor: line.from },
            effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
          });
          view.focus();
        },
        getCurrentLine: () => view.state.doc.lineAt(view.state.selection.main.head).number,
      };
    }

    return () => {
      view.destroy();
      viewRef.current = null;
      if (editorRefOut) editorRefOut.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
        annotations: externalSyncAnnotation.of(true),
      });
    }
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: [
        themeCompRef.current.reconfigure(
          createEditorThemeExtension(theme, editorFont, editorFontSize)
        ),
        pluginCompRef.current.reconfigure(makeBidiPlugin(theme, directionMode)),
        keymapCompRef.current.reconfigure(makeKeymapExtension(shortcuts)),
      ],
    });
  }, [theme, editorFont, editorFontSize, directionMode, shortcuts]);

  return (
    <div
      ref={containerRef}
      data-testid="latex-editor"
      aria-label="LaTeX Source Code Editor"
      className="h-full w-full overflow-hidden"
      style={
        {
          backgroundColor: theme.editor.bg,
          '--editor-font': editorFont.cssFamily,
          '--editor-rtl-font': editorFont.rtlFamily,
          '--editor-font-size': `${editorFontSize}px`,
        } as React.CSSProperties
      }
    />
  );
};
