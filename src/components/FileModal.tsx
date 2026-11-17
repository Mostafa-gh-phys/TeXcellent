import React, { useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  X,
  FilePlus2,
  FolderOpen,
  Download,
  Archive,
  FileText,
  Sparkles,
} from 'lucide-react';
import { EditorTheme } from '../utils/themes';
import { PROJECT_TEMPLATES, ProjectTemplate } from '../utils/defaultProjects';
import { LatexProject, ProjectFile } from '../types/latex';
import { markdownToLatex } from '../utils/latexMarkdown';

interface FileModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: EditorTheme;
  project: LatexProject;
  activeFile: ProjectFile | undefined;
  onCreateFile: (name: string, content?: string) => void;
  onNewBlankProject: (projectName: string) => void;
  onSelectTemplate: (tpl: ProjectTemplate) => void;
  onImportFiles: (files: ProjectFile[]) => void;
}

export const FileModal: React.FC<FileModalProps> = ({
  isOpen,
  onClose,
  theme,
  project,
  activeFile,
  onCreateFile,
  onNewBlankProject,
  onSelectTemplate,
  onImportFiles,
}) => {
  const [newFileName, setNewFileName] = useState('');
  const [newFileExt, setNewFileExt] = useState<'.tex' | '.bib' | '.sty' | '.cls'>('.tex');
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [feedback, setFeedback] = useState('');
  const openInputRef = useRef<HTMLInputElement | null>(null);
  const openFolderRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

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

  const handleOpenFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const imported: ProjectFile[] = [];

    // Collect webkitRelativePath if opened as a folder so we can strip shared top-level directory
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
      onImportFiles(imported);
      onClose();
    } else {
      setFeedback('No supported .tex, .bib, .sty, .cls, .md, or .zip files found.');
    }
  };

  const handleSaveCurrentFile = () => {
    if (!activeFile) return;
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
      zip.file(f.name, f.content);
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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="File and Project Templates"
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
            <h2 className="text-base font-semibold">File, Save &amp; Templates</h2>
            <p className="text-xs" style={{ color: theme.ui.textMuted }}>
              Create new files, open local .tex/.md/.zip files, save documents, or start from a template
            </p>
          </div>
          <button
            type="button"
            aria-label="Close file modal"
            onClick={onClose}
            className="p-1.5 rounded-md hover:opacity-75"
            style={{ color: theme.ui.textMuted }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
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

          {/* New File & New Blank Project */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                className="w-full py-1.5 text-xs font-semibold rounded-md"
                style={{ backgroundColor: theme.ui.accent, color: theme.ui.accentFg }}
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

          {/* Open File / Folder & Save Controls */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() => openInputRef.current?.click()}
              className="flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium rounded-lg border whitespace-nowrap"
              style={{
                backgroundColor: theme.ui.surface,
                borderColor: theme.ui.border,
                color: theme.ui.text,
              }}
            >
              <FolderOpen className="w-4 h-4" style={{ color: theme.ui.accent }} />
              Open Files
            </button>
            <input
              ref={openInputRef}
              type="file"
              multiple
              accept=".tex,.bib,.sty,.cls,.bst,.clo,.def,.cfg,.ltx,.md,.zip"
              className="hidden"
              onChange={(e) => handleOpenFiles(e.target.files)}
            />

            <button
              type="button"
              onClick={() => openFolderRef.current?.click()}
              className="flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium rounded-lg border whitespace-nowrap"
              style={{
                backgroundColor: theme.ui.surface,
                borderColor: theme.ui.border,
                color: theme.ui.text,
              }}
            >
              <FolderOpen className="w-4 h-4" style={{ color: theme.ui.accent }} />
              Open Folder
            </button>
            <input
              ref={openFolderRef}
              type="file"
              multiple
              {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
              className="hidden"
              onChange={(e) => handleOpenFiles(e.target.files)}
            />

            <button
              type="button"
              onClick={handleSaveCurrentFile}
              disabled={!activeFile}
              className="flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium rounded-lg border whitespace-nowrap disabled:opacity-50"
              style={{
                backgroundColor: theme.ui.surface,
                borderColor: theme.ui.border,
                color: theme.ui.text,
              }}
            >
              <Download className="w-4 h-4" style={{ color: theme.ui.accent }} />
              Save File
            </button>

            <button
              type="button"
              onClick={handleSaveProjectZip}
              className="flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium rounded-lg border whitespace-nowrap"
              style={{
                backgroundColor: theme.ui.surface,
                borderColor: theme.ui.border,
                color: theme.ui.text,
              }}
            >
              <Archive className="w-4 h-4" style={{ color: theme.ui.accent }} />
              Save .zip
            </button>
          </div>

          {/* Curated Templates */}
          <div className="space-y-2.5 pt-2 border-t" style={{ borderColor: theme.ui.border }}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold" style={{ color: theme.ui.textMuted }}>
                Project Templates
              </h3>
              <span className="text-[11px]" style={{ color: theme.ui.textMuted }}>
                Active project auto-saves locally
              </span>
            </div>
            <div className="space-y-2">
              {PROJECT_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    onSelectTemplate(tpl);
                    onClose();
                  }}
                  className="w-full text-left p-3.5 rounded-lg border transition-colors hover:opacity-90 flex items-start justify-between gap-3"
                  style={{
                    backgroundColor: theme.ui.surface,
                    borderColor: theme.ui.border,
                  }}
                >
                  <div>
                    <div className="text-sm font-semibold">{tpl.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: theme.ui.textMuted }}>
                      {tpl.subtitle}
                    </div>
                  </div>
                  <FileText className="w-4 h-4 shrink-0 mt-0.5" style={{ color: theme.ui.accent }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
