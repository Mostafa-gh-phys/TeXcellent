import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  Folder,
  FolderOpen,
  FolderInput,
  Plus,
  Trash2,
} from 'lucide-react';
import type { ProjectFile } from '../types/latex';
import type { EditorTheme } from '../utils/themes';
import { buildFileTree, FileTreeNode } from '../utils/fileTree';

interface FileTreeSidebarProps {
  theme: EditorTheme;
  files: ProjectFile[];
  mainFileId: string;
  activeFileId: string;
  onSelectFile: (fileId: string) => void;
  onAddFile: (filePath: string) => void;
  onDeleteFile: (fileId: string) => void;
  onOpenFolderClick: () => void;
}

export const FileTreeSidebar: React.FC<FileTreeSidebarProps> = ({
  theme,
  files,
  mainFileId,
  activeFileId,
  onSelectFile,
  onAddFile,
  onDeleteFile,
  onOpenFolderClick,
}) => {
  const [isAddingFile, setIsAddingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const tree = useMemo(() => buildFileTree(files), [files]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const current = prev[folderPath] !== false; // folders default open
      return { ...prev, [folderPath]: !current };
    });
    setSelectedFolder((prev) => (prev === folderPath ? '' : folderPath));
  };

  const handleSubmitNewFile = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = newFileName.trim().replace(/^\/+/, '');
    if (!raw) return;
    const withFolder =
      selectedFolder && !raw.includes('/') ? `${selectedFolder}/${raw}` : raw;
    onAddFile(withFolder);
    if (withFolder.includes('/')) {
      const folderPart = withFolder.split('/').slice(0, -1).join('/');
      setExpandedFolders((prev) => ({ ...prev, [folderPart]: true }));
    }
    setNewFileName('');
    setIsAddingFile(false);
  };

  const renderNodes = (nodes: FileTreeNode[], depth = 0): React.ReactNode => {
    return nodes.map((node) => {
      if (node.kind === 'folder') {
        const isOpen = expandedFolders[node.path] !== false;
        const isFolderSelected = selectedFolder === node.path;
        return (
          <div key={`folder:${node.path}`}>
            <button
              type="button"
              onClick={() => toggleFolder(node.path)}
              aria-expanded={isOpen}
              className="w-full flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs transition-colors"
              style={{
                paddingLeft: `${6 + depth * 12}px`,
                backgroundColor: isFolderSelected ? theme.ui.surfaceAlt : 'transparent',
                color: theme.ui.text,
              }}
            >
              {isOpen ? (
                <ChevronDown className="w-3 h-3 shrink-0 opacity-70" />
              ) : (
                <ChevronRight className="w-3 h-3 shrink-0 opacity-70" />
              )}
              {isOpen ? (
                <FolderOpen className="w-3.5 h-3.5 shrink-0" style={{ color: theme.ui.accent }} />
              ) : (
                <Folder className="w-3.5 h-3.5 shrink-0" style={{ color: theme.ui.accent }} />
              )}
              <span className="truncate font-semibold">{node.name}</span>
            </button>
            {isOpen && <div className="space-y-0.5">{renderNodes(node.children, depth + 1)}</div>}
          </div>
        );
      }

      const file = node.file;
      const isActive = file.id === activeFileId;
      const isMain = file.id === mainFileId;

      return (
        <div
          key={file.id}
          className="group flex items-center justify-between rounded-md pr-1.5 py-1 transition-colors"
          style={{
            paddingLeft: `${8 + depth * 12}px`,
            backgroundColor: isActive ? theme.ui.surfaceAlt : 'transparent',
          }}
        >
          <button
            type="button"
            onClick={() => onSelectFile(file.id)}
            title={node.path}
            className="flex items-center gap-1.5 text-left text-xs min-w-0 flex-1"
            style={{
              color: isActive ? theme.ui.text : theme.ui.textMuted,
              fontWeight: isActive ? 600 : 400,
            }}
          >
            <FileCode2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate font-mono">{node.name}</span>
            {isMain && (
              <span
                className="text-[9px] px-1 rounded border shrink-0"
                style={{ borderColor: theme.ui.border, color: theme.ui.textMuted }}
              >
                main
              </span>
            )}
          </button>
          {!isMain && files.length > 1 && (
            <button
              type="button"
              aria-label={`Delete ${node.path}`}
              onClick={() => onDeleteFile(file.id)}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded hover:text-red-500"
              style={{ color: theme.ui.textMuted }}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      );
    });
  };

  return (
    <aside
      aria-label="Project Files"
      className="w-56 border-r flex flex-col shrink-0 hidden sm:flex"
      style={{
        backgroundColor: theme.ui.surface,
        borderColor: theme.ui.border,
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b gap-1"
        style={{ borderColor: theme.ui.border }}
      >
        <span className="text-xs font-semibold truncate" style={{ color: theme.ui.textMuted }}>
          Project Files
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            aria-label="Open project folder"
            title="Open Folder"
            onClick={onOpenFolderClick}
            className="p-1 rounded hover:opacity-75"
            style={{ color: theme.ui.textMuted }}
          >
            <FolderInput className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="New project file"
            title={selectedFolder ? `New file in ${selectedFolder}/` : 'New file'}
            onClick={() => setIsAddingFile((v) => !v)}
            className="p-1 rounded hover:opacity-75"
            style={{ color: theme.ui.textMuted }}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isAddingFile && (
        <form
          onSubmit={handleSubmitNewFile}
          className="p-2 border-b space-y-1.5"
          style={{ borderColor: theme.ui.border }}
        >
          {selectedFolder && (
            <div className="text-[10px] font-mono truncate" style={{ color: theme.ui.textMuted }}>
              Folder: {selectedFolder}/
            </div>
          )}
          <div className="flex gap-1">
            <input
              type="text"
              aria-label="New filename"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="chapters/intro.tex"
              autoFocus
              className="flex-1 min-w-0 px-2 py-1 text-xs font-mono rounded border"
              style={{
                backgroundColor: theme.ui.bg,
                borderColor: theme.ui.border,
                color: theme.ui.text,
              }}
            />
            <button
              type="submit"
              className="px-2 py-1 text-xs font-semibold rounded"
              style={{ backgroundColor: theme.ui.accent, color: theme.ui.accentFg }}
            >
              Add
            </button>
          </div>
        </form>
      )}

      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">{renderNodes(tree)}</div>
    </aside>
  );
};
