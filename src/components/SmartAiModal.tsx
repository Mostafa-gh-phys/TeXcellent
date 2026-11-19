import React, { useMemo, useRef, useState } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Check,
  Copy,
  ArrowDownToLine,
  Loader2,
  Sparkles,
  FileCode2,
  Wand2,
  Download,
  Search,
  Blocks,
} from 'lucide-react';
import { CompilerMode } from '../types/latex';
import { EditorTheme } from '../utils/themes';
import { latexToMarkdown, markdownToLatex } from '../utils/latexMarkdown';
import { SMART_SNIPPETS, SnippetCategory } from '../utils/smartSnippets';
import { ModalShell } from './ModalShell';

interface SmartAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: EditorTheme;
  compilerMode: CompilerMode;
  activeFileContent: string;
  onInsertLatex: (latex: string) => void;
}

type SmartTab = 'image2tex' | 'md2tex' | 'tex2md' | 'snippets';

const SAMPLE_MARKDOWN = `# Spectral Convergence Summary

We analyze the discrete Laplacian $L_n$ on a manifold $\\mathcal{M}$ with **sub-Gaussian weights**.

$$
\\|\\nabla f\\|_2^2 = \\int_{\\mathcal{M}} |\\nabla f(x)|^2\\,d\\mu(x)
$$

## Key Findings

- Optimal kernel bandwidth scales as $h \\asymp n^{-1/(d+4)}$.
- Error concentrates tightly around $\\lambda_k$.

| Kernel | Order | Runtime (ms) |
| --- | --- | --- |
| Gaussian | 2 | 12.4 |
| Epanechnikov | 2 | 8.1 |
`;

export const SmartAiModal: React.FC<SmartAiModalProps> = ({
  isOpen,
  onClose,
  theme,
  compilerMode,
  activeFileContent,
  onInsertLatex,
}) => {
  const [activeTab, setActiveTab] = useState<SmartTab>('image2tex');

  // Image -> LaTeX state
  const [provider, setProvider] = useState<'online' | 'local'>('online');
  const [taskMode, setTaskMode] = useState<'auto' | 'equation' | 'table' | 'persian_ocr' | 'diagram'>('auto');
  const [localEndpoint, setLocalEndpoint] = useState('http://localhost:11434/api/generate');
  const [localModel, setLocalModel] = useState('qwen2.5vl');
  const [imageDataUrl, setImageDataUrl] = useState<string>('');
  const [imageMime, setImageMime] = useState<string>('image/png');
  const [generatedLatex, setGeneratedLatex] = useState<string>('');
  const [packages, setPackages] = useState<string[]>([]);
  const [explanation, setExplanation] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string>('');

  // Markdown <-> LaTeX state
  const [markdownInput, setMarkdownInput] = useState<string>(SAMPLE_MARKDOWN);
  const [includePreamble, setIncludePreamble] = useState<boolean>(false);
  const [mdToTexOutput, setMdToTexOutput] = useState<string>(() =>
    markdownToLatex(SAMPLE_MARKDOWN, { includePreamble: false })
  );

  const [latexInput, setLatexInput] = useState<string>('');
  const [texToMdOutput, setTexToMdOutput] = useState<string>('');
  const [markupBusy, setMarkupBusy] = useState(false);

  // Smart Snippets state
  const [snippetCategory, setSnippetCategory] = useState<'All' | SnippetCategory>('All');
  const [snippetQuery, setSnippetQuery] = useState('');
  const [onlineAiConfigured, setOnlineAiConfigured] = useState<boolean | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    fetch('/api/ai/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { onlineConfigured?: boolean } | null) => {
        if (data && typeof data.onlineConfigured === 'boolean') {
          setOnlineAiConfigured(data.onlineConfigured);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  const filteredSnippets = useMemo(() => {
    const q = snippetQuery.trim().toLowerCase();
    return SMART_SNIPPETS.filter((s) => {
      if (snippetCategory !== 'All' && s.category !== snippetCategory) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.trigger.toLowerCase().includes(q) ||
        s.packages.some((p) => p.toLowerCase().includes(q))
      );
    });
  }, [snippetCategory, snippetQuery]);

  const handleFile = React.useCallback((file: File) => {
    setError('');
    setImageMime(file.type || 'image/png');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  React.useEffect(() => {
    if (!isOpen || activeTab !== 'image2tex') return;
    const onWindowPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const pasted = item.getAsFile();
          if (pasted) {
            e.preventDefault();
            handleFile(pasted);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', onWindowPaste);
    return () => window.removeEventListener('paste', onWindowPaste);
  }, [isOpen, activeTab, handleFile]);

  if (!isOpen) return null;

  const copyText = (key: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 1500);
  };

  const handleCreateSampleEquationImage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#111827';
      ctx.font = 'italic 34px Georgia, serif';
      ctx.fillText('E[X] = ∫ x · f(x) dx   ,   σ² = E[(X - μ)²]', 48, 82);
      ctx.font = '22px Georgia, serif';
      ctx.fillStyle = '#374151';
      ctx.fillText('lim (n → ∞) (1 + 1/n)ⁿ = e', 160, 138);
      setImageDataUrl(canvas.toDataURL('image/png'));
      setImageMime('image/png');
      setError('');
    }
  };

  const handleGenerateFromImage = async () => {
    if (!imageDataUrl) {
      setError('Please upload, paste, or load a sample image first.');
      return;
    }
    setIsLoading(true);
    setError('');
    setGeneratedLatex('');

    try {
      const endpoint = provider === 'online' ? '/api/ai/image-to-latex' : '/api/ai/local-proxy';
      const body =
        provider === 'online'
          ? {
              imageBase64: imageDataUrl,
              mimeType: imageMime,
              taskMode,
              compilerMode,
            }
          : {
              endpointUrl: localEndpoint,
              modelName: localModel,
              imageBase64: imageDataUrl,
              mimeType: imageMime,
              prompt: `Convert this ${taskMode} image into clean LaTeX for ${compilerMode}. Return only LaTeX code.`,
            };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Conversion failed.');
      }
      setGeneratedLatex(data.latex || '');
      setPackages(Array.isArray(data.packages) ? data.packages : []);
      setExplanation(data.explanation || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transcribe image.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstantMdToTex = () => {
    setError('');
    const result = markdownToLatex(markdownInput, { includePreamble });
    setMdToTexOutput(result);
  };

  const handleInstantTexToMd = () => {
    setError('');
    const src = latexInput.trim() ? latexInput : activeFileContent;
    if (!latexInput.trim() && activeFileContent.trim()) {
      setLatexInput(activeFileContent);
    }
    setTexToMdOutput(latexToMarkdown(src));
  };

  const handleAiMarkupTransform = async (direction: 'md-to-latex' | 'latex-to-md') => {
    const content =
      direction === 'md-to-latex'
        ? markdownInput
        : latexInput.trim() || activeFileContent;
    if (!content.trim()) {
      setError('Provide input text before running AI refinement.');
      return;
    }
    setMarkupBusy(true);
    setError('');
    try {
      const res = await fetch('/api/ai/transform-markup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction,
          provider,
          content,
          includePreamble,
          endpointUrl: localEndpoint,
          modelName: localModel,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI transform failed.');
      if (direction === 'md-to-latex') {
        setMdToTexOutput(data.output || '');
      } else {
        setTexToMdOutput(data.output || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI transform failed.');
    } finally {
      setMarkupBusy(false);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!texToMdOutput) return;
    const blob = new Blob([texToMdOutput], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const CATEGORIES: Array<'All' | SnippetCategory> = [
    'All',
    'Bilingual & XePersian',
    'Math & Proofs',
    'Tables & Figures',
    'TikZ & Plots',
    'Document Scaffolds',
  ];

  return (
    <ModalShell<SmartTab>
      isOpen={isOpen}
      onClose={onClose}
      theme={theme}
      ariaLabel="Smart Tools and AI Assistant"
      title="Smart(+AI) Studio Tools"
      subtitle="Image OCR to LaTeX, Markdown ↔ LaTeX conversion, and curated smart snippets"
      icon={<Sparkles className="w-4 h-4" />}
      maxWidthClass="max-w-4xl"
      tabs={[
        { id: 'image2tex', label: 'Image → LaTeX', icon: <ImageIcon className="w-3.5 h-3.5" /> },
        { id: 'md2tex', label: 'Markdown → LaTeX', icon: <FileCode2 className="w-3.5 h-3.5" /> },
        { id: 'tex2md', label: 'LaTeX → Markdown', icon: <Wand2 className="w-3.5 h-3.5" /> },
        {
          id: 'snippets',
          label: 'Smart Snippets',
          icon: <Blocks className="w-3.5 h-3.5" />,
          badge: SMART_SNIPPETS.length,
        },
      ]}
      activeTab={activeTab}
      onTabChange={(nextTab) => {
        setActiveTab(nextTab);
        setError('');
        if (nextTab === 'tex2md' && !latexInput.trim() && activeFileContent.trim()) {
          setLatexInput(activeFileContent);
          setTexToMdOutput(latexToMarkdown(activeFileContent));
        }
      }}
    >
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

          {/* TAB 1: Image -> LaTeX */}
          {activeTab === 'image2tex' && (
            <div className="space-y-4">
              <div
                className="px-3 py-2 rounded-lg border text-xs flex items-center justify-between gap-2 flex-wrap"
                style={{
                  backgroundColor: theme.ui.surface,
                  borderColor:
                    provider === 'online' && onlineAiConfigured === false
                      ? '#d97706'
                      : theme.ui.border,
                  color: theme.ui.textMuted,
                }}
              >
                <span>
                  {provider === 'online'
                    ? onlineAiConfigured === true
                      ? 'Online AI (Gemini Vision) is active on the backend server.'
                      : onlineAiConfigured === false
                        ? 'Online Gemini key is not set on this server. Configure GEMINI_API_KEY in environment secrets or switch to Local Model (Ollama).'
                        : 'Checking AI Vision backend availability...'
                    : 'Local Vision Proxy active — sends image to your local Ollama / LM Studio endpoint.'}
                </span>
                {provider === 'online' && onlineAiConfigured === false && (
                  <button
                    type="button"
                    onClick={() => setProvider('local')}
                    className="px-2 py-0.5 text-[11px] font-semibold rounded border whitespace-nowrap"
                    style={{
                      backgroundColor: theme.ui.bg,
                      borderColor: theme.ui.accent,
                      color: theme.ui.accent,
                    }}
                  >
                    Switch to Local Model
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-medium mb-1.5" style={{ color: theme.ui.textMuted }}>
                    Inference Engine
                  </span>
                  <div
                    className="grid grid-cols-2 p-1 rounded-lg border"
                    style={{ backgroundColor: theme.ui.surface, borderColor: theme.ui.border }}
                  >
                    <button
                      type="button"
                      onClick={() => setProvider('online')}
                      className="py-1.5 px-3 text-xs font-medium rounded-md transition-colors"
                      style={{
                        backgroundColor: provider === 'online' ? theme.ui.bg : 'transparent',
                        color: provider === 'online' ? theme.ui.text : theme.ui.textMuted,
                      }}
                    >
                      Online AI (Vision)
                    </button>
                    <button
                      type="button"
                      onClick={() => setProvider('local')}
                      className="py-1.5 px-3 text-xs font-medium rounded-md transition-colors"
                      style={{
                        backgroundColor: provider === 'local' ? theme.ui.bg : 'transparent',
                        color: provider === 'local' ? theme.ui.text : theme.ui.textMuted,
                      }}
                    >
                      Local Model (Ollama)
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="img2tex-focus"
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: theme.ui.textMuted }}
                  >
                    Recognition Focus
                  </label>
                  <select
                    id="img2tex-focus"
                    value={taskMode}
                    onChange={(e) => setTaskMode(e.target.value as typeof taskMode)}
                    className="w-full px-3 py-2 text-xs rounded-lg border outline-none"
                    style={{
                      backgroundColor: theme.ui.surface,
                      borderColor: theme.ui.border,
                      color: theme.ui.text,
                    }}
                  >
                    <option value="auto">Auto Detect (Equations + Text)</option>
                    <option value="equation">Mathematical Equation / Matrix</option>
                    <option value="table">Booktabs Table</option>
                    <option value="persian_ocr">Bilingual Persian / English OCR</option>
                    <option value="diagram">TikZ Vector Diagram</option>
                  </select>
                </div>
              </div>

              {provider === 'local' && (
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg border"
                  style={{ backgroundColor: theme.ui.surface, borderColor: theme.ui.border }}
                >
                  <div>
                    <label
                      htmlFor="local-endpoint"
                      className="block text-xs font-medium mb-1"
                      style={{ color: theme.ui.textMuted }}
                    >
                      Local Endpoint (Ollama / LM Studio)
                    </label>
                    <input
                      id="local-endpoint"
                      type="url"
                      value={localEndpoint}
                      onChange={(e) => setLocalEndpoint(e.target.value)}
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
                      htmlFor="local-model-name"
                      className="block text-xs font-medium mb-1"
                      style={{ color: theme.ui.textMuted }}
                    >
                      Model Name
                    </label>
                    <input
                      id="local-model-name"
                      type="text"
                      value={localModel}
                      onChange={(e) => setLocalModel(e.target.value)}
                      placeholder="qwen2.5vl, llava"
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded border"
                      style={{
                        backgroundColor: theme.ui.bg,
                        borderColor: theme.ui.border,
                        color: theme.ui.text,
                      }}
                    />
                  </div>
                </div>
              )}

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFile(file);
                }}
                onPaste={(e) => {
                  const items = e.clipboardData.items;
                  for (const it of items) {
                    if (it.type.startsWith('image/')) {
                      const f = it.getAsFile();
                      if (f) handleFile(f);
                    }
                  }
                }}
                className="rounded-lg border border-dashed p-4 text-center"
                style={{
                  borderColor: theme.ui.border,
                  backgroundColor: theme.ui.surface,
                }}
              >
                {imageDataUrl ? (
                  <div className="space-y-3">
                    <img
                      src={imageDataUrl}
                      alt="Uploaded source for LaTeX transcription"
                      className="max-h-44 mx-auto rounded border bg-white object-contain"
                      style={{ borderColor: theme.ui.border }}
                    />
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 text-xs font-medium rounded border"
                        style={{
                          borderColor: theme.ui.border,
                          backgroundColor: theme.ui.bg,
                          color: theme.ui.text,
                        }}
                      >
                        Replace Image
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageDataUrl('')}
                        className="px-3 py-1.5 text-xs font-medium rounded border"
                        style={{
                          borderColor: theme.ui.border,
                          color: theme.ui.textMuted,
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-5 space-y-3">
                    <ImageIcon className="w-7 h-7 mx-auto opacity-50" />
                    <p className="text-xs" style={{ color: theme.ui.textMuted }}>
                      Drop an equation, table, or textbook photo here, paste from clipboard, or upload a file
                    </p>
                    <div className="flex items-center justify-center gap-2.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md border"
                        style={{
                          backgroundColor: theme.ui.bg,
                          borderColor: theme.ui.border,
                          color: theme.ui.text,
                        }}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Choose Image
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateSampleEquationImage}
                        className="px-3.5 py-1.5 text-xs font-medium rounded-md border"
                        style={{
                          backgroundColor: theme.ui.bg,
                          borderColor: theme.ui.border,
                          color: theme.ui.textMuted,
                        }}
                      >
                        Load Sample Equation
                      </button>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  disabled={isLoading || !imageDataUrl}
                  onClick={handleGenerateFromImage}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-opacity disabled:opacity-50"
                  style={{
                    backgroundColor: theme.ui.accent,
                    color: theme.ui.accentFg,
                  }}
                >
                  {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isLoading ? 'Transcribing Image...' : 'Generate LaTeX Code'}
                </button>
              </div>

              {generatedLatex && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium">
                      Generated LaTeX
                      {packages.length > 0 && (
                        <span className="ml-2 font-normal" style={{ color: theme.ui.textMuted }}>
                          Packages: {packages.join(', ')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyText('img', generatedLatex)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border"
                        style={{ borderColor: theme.ui.border, color: theme.ui.text }}
                      >
                        {copiedKey === 'img' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedKey === 'img' ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onInsertLatex(generatedLatex);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded"
                        style={{ backgroundColor: theme.ui.accent, color: theme.ui.accentFg }}
                      >
                        <ArrowDownToLine className="w-3.5 h-3.5" />
                        Insert at Cursor
                      </button>
                    </div>
                  </div>
                  {explanation && (
                    <p className="text-xs" style={{ color: theme.ui.textMuted }}>
                      {explanation}
                    </p>
                  )}
                  <textarea
                    aria-label="Generated LaTeX output"
                    value={generatedLatex}
                    onChange={(e) => setGeneratedLatex(e.target.value)}
                    rows={6}
                    className="w-full p-3 text-xs font-mono rounded-lg border outline-none"
                    style={{
                      backgroundColor: theme.editor.bg,
                      color: theme.editor.fg,
                      borderColor: theme.ui.border,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Markdown -> LaTeX */}
          {activeTab === 'md2tex' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includePreamble}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setIncludePreamble(next);
                      setMdToTexOutput(markdownToLatex(markdownInput, { includePreamble: next }));
                    }}
                  />
                  Include full LaTeX document preamble
                </label>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setMarkdownInput(SAMPLE_MARKDOWN);
                      setMdToTexOutput(markdownToLatex(SAMPLE_MARKDOWN, { includePreamble }));
                    }}
                    className="px-2.5 py-1 text-xs rounded border"
                    style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.surface }}
                  >
                    Load Sample
                  </button>
                  <button
                    type="button"
                    onClick={handleInstantMdToTex}
                    className="px-3 py-1 text-xs font-semibold rounded"
                    style={{ backgroundColor: theme.ui.accent, color: theme.ui.accentFg }}
                  >
                    Convert to LaTeX
                  </button>
                  <button
                    type="button"
                    disabled={markupBusy}
                    onClick={() => handleAiMarkupTransform('md-to-latex')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border"
                    style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.surface }}
                  >
                    {markupBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    AI Polish
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="md-input-area"
                    className="block text-xs font-medium mb-1"
                    style={{ color: theme.ui.textMuted }}
                  >
                    Markdown Source
                  </label>
                  <textarea
                    id="md-input-area"
                    rows={12}
                    value={markdownInput}
                    onChange={(e) => setMarkdownInput(e.target.value)}
                    placeholder="# Heading\nWrite Markdown with $math$, lists, or tables..."
                    className="w-full p-3 text-xs font-mono rounded-lg border outline-none"
                    style={{
                      backgroundColor: theme.ui.surface,
                      borderColor: theme.ui.border,
                      color: theme.ui.text,
                    }}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="md2tex-output-area"
                      className="text-xs font-medium"
                      style={{ color: theme.ui.textMuted }}
                    >
                      Converted LaTeX Output
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => copyText('md2tex', mdToTexOutput)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded border"
                        style={{ borderColor: theme.ui.border }}
                      >
                        {copiedKey === 'md2tex' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedKey === 'md2tex' ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!mdToTexOutput) return;
                          onInsertLatex(mdToTexOutput);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded"
                        style={{ backgroundColor: theme.ui.accent, color: theme.ui.accentFg }}
                      >
                        <ArrowDownToLine className="w-3 h-3" />
                        Insert
                      </button>
                    </div>
                  </div>
                  <textarea
                    id="md2tex-output-area"
                    rows={12}
                    value={mdToTexOutput}
                    onChange={(e) => setMdToTexOutput(e.target.value)}
                    className="w-full p-3 text-xs font-mono rounded-lg border outline-none"
                    style={{
                      backgroundColor: theme.editor.bg,
                      borderColor: theme.ui.border,
                      color: theme.editor.fg,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LaTeX -> Markdown */}
          {activeTab === 'tex2md' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLatexInput(activeFileContent);
                    setTexToMdOutput(latexToMarkdown(activeFileContent));
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border"
                  style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.surface }}
                >
                  <FileCode2 className="w-3.5 h-3.5" />
                  Load Active Editor File
                </button>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleInstantTexToMd}
                    className="px-3 py-1 text-xs font-semibold rounded"
                    style={{ backgroundColor: theme.ui.accent, color: theme.ui.accentFg }}
                  >
                    Convert to Markdown
                  </button>
                  <button
                    type="button"
                    disabled={markupBusy}
                    onClick={() => handleAiMarkupTransform('latex-to-md')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border"
                    style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.surface }}
                  >
                    {markupBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    AI Polish
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="tex-input-area"
                    className="block text-xs font-medium mb-1"
                    style={{ color: theme.ui.textMuted }}
                  >
                    LaTeX Input
                  </label>
                  <textarea
                    id="tex-input-area"
                    rows={12}
                    value={latexInput}
                    onChange={(e) => setLatexInput(e.target.value)}
                    placeholder="\section{Introduction} ..."
                    className="w-full p-3 text-xs font-mono rounded-lg border outline-none"
                    style={{
                      backgroundColor: theme.editor.bg,
                      borderColor: theme.ui.border,
                      color: theme.editor.fg,
                    }}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="tex2md-output-area"
                      className="text-xs font-medium"
                      style={{ color: theme.ui.textMuted }}
                    >
                      Markdown Output
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => copyText('tex2md', texToMdOutput)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded border"
                        style={{ borderColor: theme.ui.border }}
                      >
                        {copiedKey === 'tex2md' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedKey === 'tex2md' ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadMarkdown}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] rounded border"
                        style={{ borderColor: theme.ui.border }}
                      >
                        <Download className="w-3 h-3" />
                        .md
                      </button>
                    </div>
                  </div>
                  <textarea
                    id="tex2md-output-area"
                    rows={12}
                    value={texToMdOutput}
                    onChange={(e) => setTexToMdOutput(e.target.value)}
                    className="w-full p-3 text-xs font-mono rounded-lg border outline-none"
                    style={{
                      backgroundColor: theme.ui.surface,
                      borderColor: theme.ui.border,
                      color: theme.ui.text,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Smart Snippets */}
          {activeTab === 'snippets' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {CATEGORIES.map((cat) => {
                    const active = snippetCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSnippetCategory(cat)}
                        className="px-2.5 py-1 text-xs rounded-md border whitespace-nowrap"
                        style={{
                          backgroundColor: active ? theme.ui.accent : theme.ui.surface,
                          borderColor: active ? theme.ui.accent : theme.ui.border,
                          color: active ? theme.ui.accentFg : theme.ui.text,
                        }}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 opacity-50" />
                  <input
                    type="text"
                    aria-label="Filter smart snippets"
                    value={snippetQuery}
                    onChange={(e) => setSnippetQuery(e.target.value)}
                    placeholder="Search or type \snip:..."
                    className="pl-8 pr-3 py-1.5 text-xs rounded-md border"
                    style={{
                      backgroundColor: theme.ui.surface,
                      borderColor: theme.ui.border,
                      color: theme.ui.text,
                    }}
                  />
                </div>
              </div>

              <p className="text-[11px]" style={{ color: theme.ui.textMuted }}>
                Tip: You can also trigger any snippet inline inside the editor by typing its{' '}
                <code className="font-mono">\snip:...</code> prefix (e.g. <code className="font-mono">\snip:cases</code>).
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredSnippets.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border p-3.5 flex flex-col justify-between gap-2.5"
                    style={{
                      backgroundColor: theme.ui.surface,
                      borderColor: theme.ui.border,
                    }}
                  >
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold">{item.title}</div>
                          <div className="text-[11px] font-mono" style={{ color: theme.ui.accent }}>
                            {item.trigger} · {item.packages.join(', ')}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onInsertLatex(item.snippet);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded shrink-0"
                          style={{
                            backgroundColor: theme.ui.accent,
                            color: theme.ui.accentFg,
                          }}
                        >
                          <ArrowDownToLine className="w-3 h-3" />
                          Insert
                        </button>
                      </div>
                      <p className="text-[11px]" style={{ color: theme.ui.textMuted }}>
                        {item.description}
                      </p>
                    </div>
                    <pre
                      dir="ltr"
                      className="p-2 rounded border text-[11px] font-mono overflow-x-auto max-h-28"
                      style={{
                        backgroundColor: theme.editor.bg,
                        borderColor: theme.ui.border,
                        color: theme.editor.fg,
                      }}
                    >
                      {item.snippet}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
    </ModalShell>
  );
};
