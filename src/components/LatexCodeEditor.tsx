import React, { useEffect, useRef } from 'react';
import {
  EditorState,
  Compartment,
  RangeSetBuilder,
} from '@codemirror/state';
import {
  EditorView,
  Decoration,
  DecorationSet,
  Direction,
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
import { DirectionMode, ProjectFile } from '../types/latex';
import { EditorTheme } from '../utils/themes';
import { EditorFontOption } from '../utils/editorFonts';
import {
  computeBidiSpans,
  detectInputScript,
  detectLineDirection,
  tokenizeLatexLine,
} from '../utils/bidiLatex';
import { getLatexSuggestions } from '../utils/latexAutocomplete';

interface LatexCodeEditorProps {
  value: string;
  onChange: (nextValue: string) => void;
  theme: EditorTheme;
  editorFont: EditorFontOption;
  editorFontSize: number;
  directionMode: DirectionMode;
  files: ProjectFile[];
  onCursorInfo?: (info: { line: number; col: number; detectedDir: 'ltr' | 'rtl' }) => void;
  onScriptDetected?: (script: 'ltr' | 'rtl') => void;
  editorRefOut?: React.MutableRefObject<{ insertAtCursor: (snippet: string) => void } | null>;
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
      const dir = detectLineDirection(line.text, directionMode);
      allDecos.push({
        kind: 'line',
        from: line.from,
        to: line.from,
        deco: Decoration.line({ attributes: { dir } }),
      });

      // 1. Official CodeMirror BiDi isolation ranges (rendered in DOM AND fed to bidiIsolatedRanges)
      const bidiSpans = computeBidiSpans(line.text, dir);
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
      const tokens = tokenizeLatexLine(line.text);
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
  onCursorInfo,
  onScriptDetected,
  editorRefOut,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  const themeCompRef = useRef(new Compartment());
  const pluginCompRef = useRef(new Compartment());

  const latestProps = useRef({
    onChange,
    theme,
    editorFont,
    editorFontSize,
    directionMode,
    files,
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
    onCursorInfo,
    onScriptDetected,
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
        options: res.items.map((item) => ({
          label: item.label,
          detail: item.detail,
          type:
            item.kind === 'environment'
              ? 'class'
              : item.kind === 'package'
                ? 'namespace'
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
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          indentWithTab,
          {
            key: 'Ctrl-Space',
            run: startCompletion,
          },
        ]),
        themeCompRef.current.of(
          createEditorThemeExtension(theme, editorFont, editorFontSize)
        ),
        pluginCompRef.current.of(makeBidiPlugin(theme, directionMode)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const nextDoc = update.state.doc.toString();
            latestProps.current.onChange(nextDoc);

            update.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
              const insertedText = inserted.toString();
              const script = detectInputScript(insertedText);
              if (script) {
                latestProps.current.onScriptDetected?.(script);
              }
            });
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
      ],
    });
  }, [theme, editorFont, editorFontSize, directionMode]);

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
