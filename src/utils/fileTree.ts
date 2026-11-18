import type { ProjectFile } from '../types/latex';

export interface FileTreeFolderNode {
  kind: 'folder';
  name: string;
  path: string;
  children: FileTreeNode[];
}

export interface FileTreeFileNode {
  kind: 'file';
  name: string;
  path: string;
  file: ProjectFile;
}

export type FileTreeNode = FileTreeFolderNode | FileTreeFileNode;

export function normalizeProjectFilePath(rawPath: string): string {
  const unified = rawPath.replace(/\\/g, '/').trim();
  const segments = unified
    .split('/')
    .map((s) => s.trim())
    .filter((s) => Boolean(s) && s !== '.' && s !== '..');
  return segments.join('/') || 'untitled.tex';
}

export function inferFileLanguage(filePath: string): ProjectFile['language'] {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.bib')) return 'bibtex';
  if (lower.endsWith('.sty') || lower.endsWith('.cls')) return 'style';
  if (/\.(png|jpe?g|gif|webp|svg|pdf|eps)$/i.test(lower)) return 'asset';
  return 'latex';
}

export function isImageAssetFile(fileName: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(fileName);
}

export function stripSharedRootFolder(paths: string[]): string[] {
  if (paths.length === 0) return [];
  const normalized = paths.map(normalizeProjectFilePath);
  const firstSegments = normalized.map((p) => p.split('/')[0]);
  const allHaveSubpath = normalized.every((p) => p.includes('/'));
  if (!allHaveSubpath) return normalized;
  const candidateRoot = firstSegments[0];
  if (firstSegments.every((seg) => seg === candidateRoot)) {
    return normalized.map((p) => p.slice(candidateRoot.length + 1));
  }
  return normalized;
}

export function collectFolderPaths(files: ProjectFile[]): string[] {
  const folders = new Set<string>();
  for (const file of files) {
    const clean = normalizeProjectFilePath(file.name);
    const parts = clean.split('/');
    for (let i = 1; i < parts.length; i++) {
      folders.add(parts.slice(0, i).join('/'));
    }
  }
  return Array.from(folders).sort((a, b) => a.localeCompare(b));
}

export function buildFileTree(files: ProjectFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  const folderMap = new Map<string, FileTreeFolderNode>();

  const ensureFolder = (folderPath: string, name: string, parentChildren: FileTreeNode[]) => {
    const existing = folderMap.get(folderPath);
    if (existing) return existing;
    const node: FileTreeFolderNode = {
      kind: 'folder',
      name,
      path: folderPath,
      children: [],
    };
    folderMap.set(folderPath, node);
    parentChildren.push(node);
    return node;
  };

  for (const file of files) {
    const cleanPath = normalizeProjectFilePath(file.name);
    const parts = cleanPath.split('/');
    let currentChildren = root;
    let currentPath = '';

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const folderNode = ensureFolder(currentPath, part, currentChildren);
      currentChildren = folderNode.children;
    }

    const leafName = parts[parts.length - 1];
    currentChildren.push({
      kind: 'file',
      name: leafName,
      path: cleanPath,
      file,
    });
  }

  const sortNodes = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.kind === 'folder') {
        sortNodes(node.children);
      }
    }
  };

  sortNodes(root);
  return root;
}
