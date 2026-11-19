import React, { useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileCode2,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Image as ImageIcon,
  ImagePlus,
  Plus,
  Trash2,
} from 'lucide-react';
import type { LatexProject, ProjectFile } from '../types/latex';
import type { EditorTheme } from '../utils/themes';
import { buildFileTree, FileTreeNode, isImageAssetFile } from '../utils/fileTree';

interface FileTreeSidebarProps {
  theme: EditorTheme;
  projects: LatexProject[];
  activeProjectId: string;
  activeFileId: string;
  dirtyFileIds?: Set<string>;
  onSelectProjectFile: (projectId: string, fileId: string) => void;
  onSetMainFile?: (projectId: string, fileId: string) => void;
  onAddFile: (projectId: string, filePath: string) => void;
  onUploadAssets?: (projectId: string, files: FileList) => void;
  onDeleteFile: (projectId: string, fileId: string) => void;
  onCreateProject: (projectName: string) => void;
  onDeleteProject?: (projectId: string) => void;
  onOpenFolderClick: () => void;
}

export const FileTreeSidebar: React.FC<FileTreeSidebarProps> = ({
  theme,
  projects,
  activeProjectId,
  activeFileId,
  dirtyFileIds,
  onSelectProjectFile,
  onSetMainFile,
  onAddFile,
  onUploadAssets,
  onDeleteFile,
  onCreateProject,
  onDeleteProject,
  onOpenFolderClick,
}) => {
  const [composerMode, setComposerMode] = useState<'none' | 'file' | 'project'>('none');
  const [newFileName, setNewFileName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [targetProjectId, setTargetProjectId] = useState<string>(activeProjectId);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const assetUploadInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTargetProjectRef = useRef<string>(activeProjectId);

  const projectTrees = useMemo(
    () =>
      projects.map((proj) => ({
        project: proj,
        tree: buildFileTree(proj.files),
      })),
    [projects]
  );

  const isProjectExpanded = (projectId: string) => {
    if (projectId in expandedProjects) return expandedProjects[projectId];
    return projectId === activeProjectId;
  };

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [projectId]: !isProjectExpanded(projectId),
    }));
  };

  const toggleFolder = (projectId: string, folderPath: string) => {
    const key = `${projectId}:${folderPath}`;
    setExpandedFolders((prev) => {
      const current = prev[key] !== false;
      return { ...prev, [key]: !current };
    });
    setTargetProjectId(projectId);
    setSelectedFolder((prev) => (prev === folderPath ? '' : folderPath));
  };

  const openFileComposerForProject = (projectId: string) => {
    setTargetProjectId(projectId);
    setExpandedProjects((prev) => ({ ...prev, [projectId]: true }));
    setComposerMode((prev) =>
      prev === 'file' && targetProjectId === projectId ? 'none' : 'file'
    );
  };

  const handleSubmitNewFile = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = newFileName.trim().replace(/^\/+/, '');
    if (!raw) return;
    const projId =
      projects.some((p) => p.id === targetProjectId) ? targetProjectId : activeProjectId;
    const withFolder =
      selectedFolder && !raw.includes('/') ? `${selectedFolder}/${raw}` : raw;
    onAddFile(projId, withFolder);
    setExpandedProjects((prev) => ({ ...prev, [projId]: true }));
    if (withFolder.includes('/')) {
      const folderPart = withFolder.split('/').slice(0, -1).join('/');
      setExpandedFolders((prev) => ({ ...prev, [`${projId}:${folderPart}`]: true }));
    }
    setNewFileName('');
    setComposerMode('none');
  };

  const handleSubmitNewProject = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newProjectName.trim() || `Project ${projects.length + 1}`;
    onCreateProject(title);
    setNewProjectName('');
    setComposerMode('none');
  };

  const renderFileIcon = (file: ProjectFile) => {
    if (file.language === 'asset' || isImageAssetFile(file.name)) {
      return <ImageIcon className="w-3.5 h-3.5 shrink-0 opacity-85" />;
    }
    if (file.language === 'bibtex' || file.name.toLowerCase().endsWith('.bib')) {
      return <BookOpen className="w-3.5 h-3.5 shrink-0 opacity-85" />;
    }
    return <FileCode2 className="w-3.5 h-3.5 shrink-0" />;
  };

  const renderNodes = (
    nodes: FileTreeNode[],
    depth: number,
    proj: LatexProject
  ): React.ReactNode => {
    const isActiveProject = proj.id === activeProjectId;
    return nodes.map((node) => {
      if (node.kind === 'folder') {
        const folderKey = `${proj.id}:${node.path}`;
        const isOpen = expandedFolders[folderKey] !== false;
        const isFolderSelected =
          targetProjectId === proj.id && selectedFolder === node.path;
        return (
          <div key={`folder:${folderKey}`}>
            <button
              type="button"
              onClick={() => toggleFolder(proj.id, node.path)}
              aria-expanded={isOpen}
              className="w-full flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs transition-colors"
              style={{
                paddingLeft: `${8 + depth * 12}px`,
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
              <span className="truncate font-medium">{node.name}</span>
            </button>
            {isOpen && (
              <div className="space-y-0.5">{renderNodes(node.children, depth + 1, proj)}</div>
            )}
          </div>
        );
      }

      const file = node.file;
      const isActive = isActiveProject && file.id === activeFileId;
      const isMain = file.id === proj.mainFileId;
      const isDirty = Boolean(dirtyFileIds?.has(file.id));

      return (
        <div
          key={`${proj.id}:${file.id}`}
          className="group flex items-center justify-between rounded-md pr-1.5 py-1 transition-colors"
          style={{
            paddingLeft: `${10 + depth * 12}px`,
            backgroundColor: isActive ? theme.ui.surfaceAlt : 'transparent',
          }}
        >
          <button
            type="button"
            onClick={() => onSelectProjectFile(proj.id, file.id)}
            title={`${proj.name} / ${node.path}${isDirty ? ' (unsaved)' : ''}`}
            className="flex items-center gap-1.5 text-left text-xs min-w-0 flex-1"
            style={{
              color: isActive ? theme.ui.text : theme.ui.textMuted,
              fontWeight: isActive ? 600 : 400,
            }}
          >
            {renderFileIcon(file)}
            <span className="truncate font-mono">{node.name}</span>
            {isDirty && (
              <span
                aria-label="Unsaved changes"
                title="Unsaved changes"
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: theme.ui.accent }}
              />
            )}
            {isMain && (
              <span
                className="text-[9px] px-1 rounded border shrink-0"
                style={{ borderColor: theme.ui.border, color: theme.ui.textMuted }}
              >
                main
              </span>
            )}
          </button>
          <div className="flex items-center gap-0.5 shrink-0">
            {!isMain && file.language === 'latex' && onSetMainFile && (
              <button
                type="button"
                aria-label={`Set ${node.path} as main file in ${proj.name}`}
                title="Set as main document"
                onClick={() => onSetMainFile(proj.id, file.id)}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 px-1 py-0.5 text-[9px] font-medium rounded border"
                style={{ borderColor: theme.ui.border, color: theme.ui.textMuted }}
              >
                main
              </button>
            )}
            {!isMain && proj.files.length > 1 && (
              <button
                type="button"
                aria-label={`Delete ${node.path} from ${proj.name}`}
                onClick={() => onDeleteFile(proj.id, file.id)}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded hover:text-red-500"
                style={{ color: theme.ui.textMuted }}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      );
    });
  };

  return (
    <aside
      aria-label="Project Files"
      data-testid="project-files-sidebar"
      className="w-60 border-r flex flex-col shrink-0 hidden sm:flex"
      style={{
        backgroundColor: theme.ui.surface,
        borderColor: theme.ui.border,
      }}
    >
      <input
        ref={assetUploadInputRef}
        type="file"
        multiple
        accept=".tex,.bib,.sty,.cls,.png,.jpg,.jpeg,.gif,.webp,.svg,.pdf,.eps"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0 && onUploadAssets) {
            onUploadAssets(uploadTargetProjectRef.current, e.target.files);
          }
          e.target.value = '';
        }}
      />

      <div
        className="flex items-center justify-between px-3 py-2 border-b gap-1"
        style={{ borderColor: theme.ui.border }}
      >
        <span className="text-xs font-semibold truncate" style={{ color: theme.ui.textMuted }}>
          Projects ({projects.length})
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            aria-label="Open project folder"
            title="Open Folder as Project"
            onClick={onOpenFolderClick}
            className="p-1 rounded hover:opacity-75"
            style={{ color: theme.ui.textMuted }}
          >
            <FolderInput className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="New project folder"
            title="New Project"
            onClick={() =>
              setComposerMode((prev) => (prev === 'project' ? 'none' : 'project'))
            }
            className="p-1 rounded hover:opacity-75"
            style={{ color: theme.ui.textMuted }}
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="New project file"
            title={selectedFolder ? `New file in ${selectedFolder}/` : 'New file in active project'}
            onClick={() => openFileComposerForProject(activeProjectId)}
            className="p-1 rounded hover:opacity-75"
            style={{ color: theme.ui.textMuted }}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {composerMode === 'project' && (
        <form
          onSubmit={handleSubmitNewProject}
          className="p-2 border-b space-y-1.5"
          style={{ borderColor: theme.ui.border }}
        >
          <div className="text-[10px] font-semibold" style={{ color: theme.ui.textMuted }}>
            New Project Folder
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              aria-label="New project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder={`Project ${projects.length + 1}`}
              autoFocus
              className="flex-1 min-w-0 px-2 py-1 text-xs rounded border"
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

      {composerMode === 'file' && (
        <form
          onSubmit={handleSubmitNewFile}
          className="p-2 border-b space-y-1.5"
          style={{ borderColor: theme.ui.border }}
        >
          <div className="text-[10px] font-mono truncate" style={{ color: theme.ui.textMuted }}>
            {projects.find((p) => p.id === targetProjectId)?.name || 'Project'}
            {selectedFolder ? ` / ${selectedFolder}/` : ''}
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              aria-label="New filename"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="chapter 1.tex"
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

      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {projectTrees.map(({ project: proj, tree }) => {
          const isExpanded = isProjectExpanded(proj.id);
          const isCurrentProject = proj.id === activeProjectId;
          return (
            <div
              key={proj.id}
              data-testid={`project-folder-${proj.id}`}
              className="space-y-0.5"
            >
              <div
                className="group flex items-center justify-between rounded-md px-1.5 py-1 transition-colors"
                style={{
                  backgroundColor: isCurrentProject ? theme.ui.bg : 'transparent',
                  border: isCurrentProject
                    ? `1px solid ${theme.ui.border}`
                    : '1px solid transparent',
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleProject(proj.id)}
                  aria-expanded={isExpanded}
                  title={proj.name}
                  className="flex items-center gap-1.5 text-left text-xs min-w-0 flex-1"
                  style={{ color: theme.ui.text }}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-75" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-75" />
                  )}
                  {isExpanded ? (
                    <FolderOpen
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: theme.ui.accent }}
                    />
                  ) : (
                    <Folder
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: theme.ui.accent }}
                    />
                  )}
                  <span className="truncate font-semibold">{proj.name}</span>
                </button>

                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    aria-label={`New file in ${proj.name}`}
                    title={`New file in ${proj.name}`}
                    onClick={() => openFileComposerForProject(proj.id)}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded hover:opacity-80"
                    style={{ color: theme.ui.textMuted }}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  {onUploadAssets && (
                    <button
                      type="button"
                      aria-label={`Add image or file to ${proj.name}`}
                      title={`Upload image / .tex / .bib to ${proj.name}`}
                      onClick={() => {
                        uploadTargetProjectRef.current = proj.id;
                        assetUploadInputRef.current?.click();
                      }}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded hover:opacity-80"
                      style={{ color: theme.ui.textMuted }}
                    >
                      <ImagePlus className="w-3 h-3" />
                    </button>
                  )}
                  {projects.length > 1 && onDeleteProject && (
                    <button
                      type="button"
                      aria-label={`Delete project ${proj.name}`}
                      title={`Delete ${proj.name}`}
                      onClick={() => onDeleteProject(proj.id)}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded hover:text-red-500"
                      style={{ color: theme.ui.textMuted }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div
                  className="ml-2.5 pl-1 border-l space-y-0.5"
                  style={{ borderColor: theme.ui.border }}
                >
                  {renderNodes(tree, 0, proj)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
