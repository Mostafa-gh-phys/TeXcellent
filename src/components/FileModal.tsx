import React, { useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  FilePlus2,
  FolderOpen,
  Download,
  Archive,
  FileText,
  Sparkles,
  FolderOutput,
  BookTemplate,
  Save,
} from 'lucide-react';
import { EditorTheme } from '../utils/themes';
import { PROJECT_TEMPLATES, ProjectTemplate } from '../utils/defaultProjects';
import { LatexProject, ProjectFile } from '../types/latex';
import { markdownToLatex } from '../utils/latexMarkdown';
import { ModalShell } from './ModalShell';

type FileModalTab = 'workspace' | 'templates';

interface FileModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: EditorTheme;
  project: LatexProject;
  activeFile: ProjectFile | undefined;
  activeFileDirty?: boolean;
  bundleDownloadUrl?: string;
  onSaveActiveFile?: () => Promise<boolean> | void;
  onCreateFile: (name: string, content?: string) => void;
  onNewBlankProject: (projectName: string) => void;
  onSelectTemplate: (tpl: ProjectTemplate) => void;
  onImportFiles: (files: ProjectFile[], folderProjectName?: string) => void;
}

export const FileModal: React.FC<FileModalProps> = ({
  isOpen,
  onClose,
  theme,
  project,
  activeFile,
  activeFileDirty = false,
  bundleDownloadUrl,
  onSaveActiveFile,
  onCreateFile,
  onNewBlankProject,
  onSelectTemplate,
  onImportFiles,
}) => {
  const [activeTab, setActiveTab] = useState<FileModalTab>('workspace');
  const [newFileName, setNewFileName] = useState('');
  const [newFileExt, setNewFileExt] = useState<'.tex' | '.bib' | '.sty' | '.cls'>('.tex');
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [feedback, setFeedback] = useState('');
  const openInputRef = useRef<HTMLInputElement | null>(null);
  const openFolderRef = useRef<HTMLInputElement | null>(null);

  const handleCreateNewFile = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = newFileName.trim();
    if (!raw) return;
    const finalName = /\.(tex|bib|sty|cls)$/i.test(raw) ? raw : `${raw}${newFileExt}`;
    onCreateFile(finalName);
    setNewFileName('');
    setFeedback(`Created ${finalName}`);
    onClose();
  };

  const handleCreateBlankProject = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newProjectTitle.trim() || 'Untitled TeX Project';
    onNewBlankProject(title);
    setNewProjectTitle('');
    onClose();
  };

  const inferMimeType = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.svg')) return 'image/svg+xml';
    if (lower.endsWith('.pdf')) return 'application/pdf';
    return 'application/octet-stream';
  };

  const toBase64 = (buf: ArrayBuffer): string => {
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  };

  const handleOpenFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const imported: ProjectFile[] = [];

    const rawList = Array.from(fileList);
    const relPaths = rawList.map((f) => {
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
      return rel && rel.includes('/') ? rel : f.name;
    });
    const allInFolder = relPaths.length > 0 && relPaths.every((p) => p.includes('/'));
    const topFolder = allInFolder ? relPaths[0].split('/')[0] : '';
    const canStripTop = allInFolder && relPaths.every((p) => p.split('/')[0] === topFolder);

    for (let idx = 0; idx < rawList.length; idx++) {
      const file = rawList[idx];
      let relName = relPaths[idx];
      if (canStripTop) {
        relName = relName.slice(topFolder.length + 1);
      }

      if (/\.zip$/i.test(file.name)) {
        const zip = await JSZip.loadAsync(file);
        for (const [entryName, entry] of Object.entries(zip.files)) {
          if (entry.dir) continue;
          const normalizedEntry = entryName.replace(/^\/+/, '');
          if (/\.(tex|bib|sty|cls|bst|clo|def|cfg|ltx)$/i.test(normalizedEntry)) {
            const content = await entry.async('string');
            imported.push({
              id: `open-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: normalizedEntry,
              content,
              language: normalizedEntry.endsWith('.bib')
                ? 'bibtex'
                : /\.(sty|cls|bst|clo|def|cfg)$/i.test(normalizedEntry)
                  ? 'style'
                  : 'latex',
              updatedAt: new Date().toISOString(),
            });
          } else if (/\.(png|jpe?g|gif|webp|svg|pdf|eps)$/i.test(normalizedEntry)) {
            const buf = await entry.async('arraybuffer');
            imported.push({
              id: `open-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: normalizedEntry,
              content: '',
              language: 'asset',
              binaryBase64: toBase64(buf),
              mimeType: inferMimeType(normalizedEntry),
              updatedAt: new Date().toISOString(),
            });
          } else if (/\.md$/i.test(normalizedEntry)) {
            const mdText = await entry.async('string');
            const texName = normalizedEntry.replace(/\.md$/i, '.tex');
            imported.push({
              id: `open-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: texName,
              content: markdownToLatex(mdText, {
                includePreamble: true,
                title: normalizedEntry.replace(/\.md$/i, ''),
              }),
              language: 'latex',
              updatedAt: new Date().toISOString(),
            });
          }
        }
      } else if (/\.md$/i.test(relName)) {
        const mdText = await file.text();
        const texName = relName.replace(/\.md$/i, '.tex');
        imported.push({
          id: `open-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: texName,
          content: markdownToLatex(mdText, {
            includePreamble: true,
            title: relName.replace(/\.md$/i, ''),
          }),
          language: 'latex',
          updatedAt: new Date().toISOString(),
        });
      } else if (/\.(png|jpe?g|gif|webp|svg|pdf|eps)$/i.test(relName)) {
        const buf = await file.arrayBuffer();
        imported.push({
          id: `open-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: relName,
          content: '',
          language: 'asset',
          binaryBase64: toBase64(buf),
          mimeType: file.type || inferMimeType(relName),
          updatedAt: new Date().toISOString(),
        });
      } else if (/\.(tex|bib|sty|cls|bst|clo|def|cfg|ltx)$/i.test(relName)) {
        const text = await file.text();
        imported.push({
          id: `open-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: relName,
          content: text,
          language: relName.endsWith('.bib')
            ? 'bibtex'
            : /\.(sty|cls|bst|clo|def|cfg)$/i.test(relName)
              ? 'style'
              : 'latex',
          updatedAt: new Date().toISOString(),
        });
      }
    }

    if (imported.length > 0) {
      onImportFiles(imported, canStripTop ? topFolder : undefined);
      onClose();
    } else {
      setFeedback('No supported .tex, .bib, .sty, .cls, .png, .jpg, .svg, .md, or .zip files found.');
    }
  };

  const handleSaveCurrentFile = async () => {
    if (!activeFile) return;
    if (onSaveActiveFile) {
      const saved = await onSaveActiveFile();
      if (saved !== false) {
        setFeedback(`Saved ${activeFile.name} to disk.`);
      }
      return;
    }
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback(`Saved ${activeFile.name} to disk.`);
  };

  const handleSaveProjectZip = async () => {
    const zip = new JSZip();
    for (const f of project.files) {
      if (f.language === 'asset' && f.binaryBase64) {
        zip.file(f.name, f.binaryBase64, { base64: true });
      } else {
        zip.file(f.name, f.content);
      }
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'texcellent-project';
    a.download = `${slug}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback(`Saved ${project.files.length}-file archive (${slug}.zip).`);
  };

  return (
    <ModalShell<FileModalTab>
      isOpen={isOpen}
      onClose={onClose}
      theme={theme}
      ariaLabel="File and Project Templates"
      title="File, Save & Templates"
      subtitle={`Active project: ${project.name} (${project.files.length} files)`}
      icon={<FileText className="w-4 h-4" />}
      maxWidthClass="max-w-2xl"
      tabs={[
        { id: 'workspace', label: 'Workspace & Save', icon: <Save className="w-3.5 h-3.5" /> },
        {
          id: 'templates',
          label: 'Templates',
          icon: <BookTemplate className="w-3.5 h-3.5" />,
          badge: PROJECT_TEMPLATES.length,
        },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      footer={
        <>
          <span className="text-[11px]" style={{ color: theme.ui.textMuted }}>
            {activeFile
              ? `${activeFile.name}${activeFileDirty ? ' · Unsaved changes' : ' · Synced'}`
              : 'Auto-saves locally in browser storage'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-md"
            style={{ backgroundColor: theme.ui.accent, color: theme.ui.accentFg }}
          >
            Done
          </button>
        </>
      }
    >
      {feedback && (
        <div
          className="p-2.5 rounded-lg border text-xs"
          style={{
            backgroundColor: theme.ui.surface,
            borderColor: theme.ui.accent,
            color: theme.ui.text,
          }}
        >
          {feedback}
        </div>
      )}

      {activeTab === 'workspace' ? (
        <div className="space-y-4">
          {/* Local Open & Save Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              className="p-3.5 rounded-lg border space-y-2.5"
              style={{ backgroundColor: theme.ui.surface, borderColor: theme.ui.border }}
            >
              <div className="text-xs font-semibold">Open from Disk</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openInputRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border whitespace-nowrap"
                  style={{
                    backgroundColor: theme.ui.bg,
                    borderColor: theme.ui.border,
                    color: theme.ui.text,
                  }}
                >
                  <FolderOpen className="w-3.5 h-3.5" style={{ color: theme.ui.accent }} />
                  Open Files
                </button>
                <button
                  type="button"
                  onClick={() => openFolderRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border whitespace-nowrap"
                  style={{
                    backgroundColor: theme.ui.bg,
                    borderColor: theme.ui.border,
                    color: theme.ui.text,
                  }}
                >
                  <FolderOpen className="w-3.5 h-3.5" style={{ color: theme.ui.accent }} />
                  Open Folder
                </button>
              </div>
              <p className="text-[11px]" style={{ color: theme.ui.textMuted }}>
                Supports .tex, .bib, .sty, .md, images, and .zip archives.
              </p>
              <input
                ref={openInputRef}
                type="file"
                multiple
                accept=".tex,.bib,.sty,.cls,.bst,.clo,.def,.cfg,.ltx,.md,.zip,.png,.jpg,.jpeg,.gif,.webp,.svg,.pdf,.eps"
                className="hidden"
                onChange={(e) => handleOpenFiles(e.target.files)}
              />
              <input
                ref={openFolderRef}
                type="file"
                multiple
                {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
                className="hidden"
                onChange={(e) => handleOpenFiles(e.target.files)}
              />
            </div>

            <div
              className="p-3.5 rounded-lg border space-y-2.5"
              style={{ backgroundColor: theme.ui.surface, borderColor: theme.ui.border }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">Save &amp; Export</span>
                {activeFileDirty && (
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: theme.ui.surfaceAlt, color: theme.ui.accent }}
                  >
                    Unsaved
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleSaveCurrentFile}
                  disabled={!activeFile}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md whitespace-nowrap disabled:opacity-50"
                  style={{
                    backgroundColor: theme.ui.accent,
                    color: theme.ui.accentFg,
                  }}
                >
                  <Download className="w-3.5 h-3.5" />
                  Save File
                </button>
                <button
                  type="button"
                  onClick={handleSaveProjectZip}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border whitespace-nowrap"
                  style={{
                    backgroundColor: theme.ui.bg,
                    borderColor: theme.ui.border,
                    color: theme.ui.text,
                  }}
                >
                  <Archive className="w-3.5 h-3.5" style={{ color: theme.ui.accent }} />
                  Project .zip
                </button>
              </div>
              {bundleDownloadUrl ? (
                <a
                  href={bundleDownloadUrl}
                  download="compile-outputs.zip"
                  className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border hover:opacity-85"
                  style={{
                    backgroundColor: theme.ui.bg,
                    borderColor: theme.ui.border,
                    color: theme.ui.text,
                  }}
                >
                  <FolderOutput className="w-3.5 h-3.5" style={{ color: theme.ui.accent }} />
                  Save Compiled Outputs (.pdf, .aux, .log)
                </a>
              ) : (
                <p className="text-[11px]" style={{ color: theme.ui.textMuted }}>
                  Press Ctrl+S / Cmd+S anytime to save the active file.
                </p>
              )}
            </div>
          </div>

          {/* New File & New Blank Project */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <form
              onSubmit={handleCreateNewFile}
              className="p-3.5 rounded-lg border space-y-2.5"
              style={{ backgroundColor: theme.ui.surface, borderColor: theme.ui.border }}
            >
              <div className="flex items-center gap-2 text-xs font-semibold">
                <FilePlus2 className="w-4 h-4" style={{ color: theme.ui.accent }} />
                <span>New File in Project</span>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  aria-label="New file name"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="chapter2"
                  className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono rounded border"
                  style={{
                    backgroundColor: theme.ui.bg,
                    borderColor: theme.ui.border,
                    color: theme.ui.text,
                  }}
                />
                <select
                  aria-label="File extension"
                  value={newFileExt}
                  onChange={(e) => setNewFileExt(e.target.value as typeof newFileExt)}
                  className="px-2 py-1.5 text-xs font-mono rounded border"
                  style={{
                    backgroundColor: theme.ui.bg,
                    borderColor: theme.ui.border,
                    color: theme.ui.text,
                  }}
                >
                  <option value=".tex">.tex</option>
                  <option value=".bib">.bib</option>
                  <option value=".sty">.sty</option>
                  <option value=".cls">.cls</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full py-1.5 text-xs font-medium rounded-md border"
                style={{
                  backgroundColor: theme.ui.bg,
                  borderColor: theme.ui.border,
                  color: theme.ui.text,
                }}
              >
                Create File
              </button>
            </form>

            <form
              onSubmit={handleCreateBlankProject}
              className="p-3.5 rounded-lg border space-y-2.5"
              style={{ backgroundColor: theme.ui.surface, borderColor: theme.ui.border }}
            >
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Sparkles className="w-4 h-4" style={{ color: theme.ui.accent }} />
                <span>New Blank Project</span>
              </div>
              <input
                type="text"
                aria-label="New blank project title"
                value={newProjectTitle}
                onChange={(e) => setNewProjectTitle(e.target.value)}
                placeholder="Untitled Research Paper"
                className="w-full px-2.5 py-1.5 text-xs rounded border"
                style={{
                  backgroundColor: theme.ui.bg,
                  borderColor: theme.ui.border,
                  color: theme.ui.text,
                }}
              />
              <button
                type="submit"
                className="w-full py-1.5 text-xs font-medium rounded-md border"
                style={{
                  backgroundColor: theme.ui.bg,
                  borderColor: theme.ui.border,
                  color: theme.ui.text,
                }}
              >
                Start Blank Document
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <p className="text-xs" style={{ color: theme.ui.textMuted }}>
            Create a new project folder from a ready-to-compile bilingual or academic starter template.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PROJECT_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  onSelectTemplate(tpl);
                  onClose();
                }}
                className="text-left p-3.5 rounded-lg border transition-colors hover:opacity-90 flex items-start justify-between gap-3"
                style={{
                  backgroundColor: theme.ui.surface,
                  borderColor: theme.ui.border,
                }}
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{tpl.name}</div>
                  <div className="text-[11px] mt-1 leading-relaxed" style={{ color: theme.ui.textMuted }}>
                    {tpl.subtitle}
                  </div>
                </div>
                <FileText className="w-4 h-4 shrink-0 mt-0.5" style={{ color: theme.ui.accent }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </ModalShell>
  );
};
