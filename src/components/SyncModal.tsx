import React, { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  Archive,
  CheckCircle2,
  Cloud,
  Download,
  ExternalLink,
  FolderPlus,
  Github,
  Globe,
  RefreshCw,
  Rocket,
  Upload,
  UploadCloud,
} from 'lucide-react';
import { LatexProject, ProjectFile, SyncConfig } from '../types/latex';
import { EditorTheme } from '../utils/themes';
import { ModalShell } from './ModalShell';

type SyncTab = 'github' | 'overleaf' | 'easytex' | 'archive';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: EditorTheme;
  project: LatexProject;
  syncConfig: SyncConfig;
  onUpdateSyncConfig: (next: SyncConfig) => void;
  onImportPulledFiles: (files: ProjectFile[]) => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  theme,
  project,
  syncConfig,
  onUpdateSyncConfig,
  onImportPulledFiles,
}) => {
  const [activeTab, setActiveTab] = useState<SyncTab>('github');
  const [ghSessionKey, setGhSessionKey] = useState('');
  const [ghRepos, setGhRepos] = useState<Array<{ fullName: string; defaultBranch: string }>>([]);
  const [commitMessage, setCommitMessage] = useState('Update LaTeX project from TeXcellent');
  const [newRepoName, setNewRepoName] = useState('TeXcellent');
  const [newRepoPrivate, setNewRepoPrivate] = useState(false);
  const [publishedActionsUrl, setPublishedActionsUrl] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) return;
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.provider === 'github') {
        const key = event.data.sessionKey as string;
        const username = (event.data.username as string) || '';
        setGhSessionKey(key);
        onUpdateSyncConfig({
          ...syncConfig,
          github: { ...syncConfig.github, connected: true, username },
        });
        setStatusMessage(`Connected to GitHub as @${username}`);
        fetchGithubRepos('', key);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncConfig]);

  const fetchGithubRepos = async (tokenOverride?: string, sessionOverride?: string) => {
    setIsBusy(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/github/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenOverride ?? syncConfig.github.token,
          sessionKey: sessionOverride ?? ghSessionKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load repositories.');
      setGhRepos(data.repos || []);
      onUpdateSyncConfig({
        ...syncConfig,
        github: {
          ...syncConfig.github,
          connected: true,
          username: data.username || syncConfig.github.username,
          repo: syncConfig.github.repo || data.repos?.[0]?.fullName || '',
        },
      });
      setStatusMessage(`Loaded ${data.repos?.length || 0} repositories for @${data.username}`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'GitHub connection failed.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleGithubOAuth = async () => {
    setErrorMessage('');
    setStatusMessage('');
    try {
      const res = await fetch('/api/auth/github/url');
      const data = await res.json();
      if (!data.configured) {
        setStatusMessage(data.message);
        return;
      }
      window.open(data.url, 'github_oauth_popup', 'width=620,height=720');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to initiate GitHub OAuth.');
    }
  };

  const handleGithubPush = async () => {
    setIsBusy(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const res = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: syncConfig.github.token,
          sessionKey: ghSessionKey,
          repo: syncConfig.github.repo,
          branch: syncConfig.github.branch || 'main',
          basePath: syncConfig.github.basePath || '',
          commitMessage,
          files: project.files,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'GitHub push failed.');
      onUpdateSyncConfig({
        ...syncConfig,
        github: { ...syncConfig.github, lastSyncedAt: data.timestamp },
      });
      setStatusMessage(`Pushed ${data.syncedFiles?.length || 0} file(s) to ${data.repo} (${data.branch}).`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'GitHub push failed.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleGithubPull = async () => {
    setIsBusy(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const res = await fetch('/api/github/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: syncConfig.github.token,
          sessionKey: ghSessionKey,
          repo: syncConfig.github.repo,
          branch: syncConfig.github.branch || 'main',
          basePath: syncConfig.github.basePath || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'GitHub pull failed.');
      if (data.files?.length) {
        onImportPulledFiles(data.files);
      }
      setStatusMessage(`Pulled ${data.files?.length || 0} TeX/BibTeX file(s) from ${syncConfig.github.repo}.`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'GitHub pull failed.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleOverleafSync = async (action: 'verify' | 'push' | 'pull') => {
    setIsBusy(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const res = await fetch('/api/sync/overleaf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          projectId: syncConfig.overleaf.projectId,
          gitToken: syncConfig.overleaf.gitToken,
          customHost: syncConfig.overleaf.customHost || 'https://git.overleaf.com',
          files: project.files,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Overleaf sync failed.');
      if (action === 'pull' && data.files?.length) {
        onImportPulledFiles(data.files);
      }
      onUpdateSyncConfig({
        ...syncConfig,
        overleaf: { ...syncConfig.overleaf, lastSyncedAt: data.timestamp },
      });
      setStatusMessage(data.message || `Overleaf ${action} completed.`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Overleaf sync error.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleEasyTexSync = async (action: 'test' | 'push') => {
    setIsBusy(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const res = await fetch('/api/sync/easytex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          instanceUrl: syncConfig.easytex.instanceUrl || 'https://easytex.ir',
          projectUrl: syncConfig.easytex.projectUrl,
          apiToken: syncConfig.easytex.apiToken,
          files: project.files,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'easytex.ir sync failed.');
      onUpdateSyncConfig({
        ...syncConfig,
        easytex: { ...syncConfig.easytex, lastSyncedAt: data.timestamp },
      });
      setStatusMessage(data.message || 'easytex.ir sync succeeded.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'easytex.ir connection failed.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDownloadProjectZip = async (targetLabel: string) => {
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
    a.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${targetLabel}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage(`Exported ${project.files.length} files as ${targetLabel} project archive.`);
  };

  const handleImportProjectFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList?.length) return;
    setIsBusy(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const imported: ProjectFile[] = [];
      for (const file of Array.from(fileList)) {
        if (/\.zip$/i.test(file.name)) {
          const zip = await JSZip.loadAsync(file);
          for (const [entryName, entry] of Object.entries(zip.files)) {
            if (entry.dir) continue;
            if (/\.(tex|bib|sty|cls)$/i.test(entryName)) {
              const content = await entry.async('string');
              const baseName = entryName.split('/').pop() || entryName;
              imported.push({
                id: `imp-${baseName}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                name: baseName,
                content,
                language: baseName.endsWith('.bib')
                  ? 'bibtex'
                  : baseName.endsWith('.sty') || baseName.endsWith('.cls')
                    ? 'style'
                    : 'latex',
                updatedAt: new Date().toISOString(),
              });
            }
          }
        } else if (/\.(tex|bib|sty|cls)$/i.test(file.name)) {
          const content = await file.text();
          imported.push({
            id: `imp-${file.name}-${Date.now()}`,
            name: file.name,
            content,
            language: file.name.endsWith('.bib')
              ? 'bibtex'
              : file.name.endsWith('.sty') || file.name.endsWith('.cls')
                ? 'style'
                : 'latex',
            updatedAt: new Date().toISOString(),
          });
        }
      }
      if (!imported.length) {
        setErrorMessage('No .tex, .bib, .sty, or .cls files found in the selected archive.');
      } else {
        onImportPulledFiles(imported);
        setStatusMessage(`Imported ${imported.length} file(s) into "${project.name}".`);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to import project files.');
    } finally {
      setIsBusy(false);
      e.target.value = '';
    }
  };

  const handleCreateGithubRepo = async () => {
    if (!newRepoName.trim()) return;
    setIsBusy(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const res = await fetch('/api/github/create-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: syncConfig.github.token,
          sessionKey: ghSessionKey,
          name: newRepoName.trim(),
          isPrivate: newRepoPrivate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create GitHub repository.');
      onUpdateSyncConfig({
        ...syncConfig,
        github: {
          ...syncConfig.github,
          connected: true,
          repo: data.fullName || syncConfig.github.repo,
          branch: data.defaultBranch || 'main',
        },
      });
      if (data.fullName) {
        setGhRepos((prev) => [{ fullName: data.fullName, defaultBranch: data.defaultBranch || 'main' }, ...prev]);
      }
      setStatusMessage(`Created GitHub repository ${data.fullName}.`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create repository.');
    } finally {
      setIsBusy(false);
    }
  };

  const handlePublishTeXcellentApp = async () => {
    setIsBusy(true);
    setErrorMessage('');
    setStatusMessage('');
    setPublishedActionsUrl('');
    try {
      const res = await fetch('/api/github/publish-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: syncConfig.github.token,
          sessionKey: ghSessionKey,
          repo: syncConfig.github.repo,
          branch: syncConfig.github.branch || 'main',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish TeXcellent app to GitHub.');
      setPublishedActionsUrl(data.actionsUrl || '');
      setStatusMessage(
        `Published ${data.fileCount} TeXcellent app & workflow files to ${data.repo} (${data.branch}).`
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'App publish failed.');
    } finally {
      setIsBusy(false);
    }
  };

  const mainFile = project.files.find((f) => f.id === project.mainFileId) || project.files[0];

  return (
    <ModalShell<SyncTab>
      isOpen={isOpen}
      onClose={onClose}
      theme={theme}
      ariaLabel="Cloud and Repository Sync"
      title="Project Sync & Cloud Connectors"
      subtitle={`Sync "${project.name}" with GitHub, Overleaf, easytex.ir, or local archives`}
      icon={<Cloud className="w-4 h-4" />}
      maxWidthClass="max-w-2xl"
      tabs={[
        { id: 'github', label: 'GitHub', icon: <Github className="w-3.5 h-3.5" /> },
        { id: 'overleaf', label: 'Overleaf', icon: <Cloud className="w-3.5 h-3.5" /> },
        { id: 'easytex', label: 'easytex.ir', icon: <Globe className="w-3.5 h-3.5" /> },
        {
          id: 'archive',
          label: 'Archive (.zip)',
          icon: <Archive className="w-3.5 h-3.5" />,
          badge: project.files.length,
        },
      ]}
      activeTab={activeTab}
      onTabChange={(nextTab) => {
        setActiveTab(nextTab);
        setErrorMessage('');
        setStatusMessage('');
      }}
      footer={
        <>
          <span className="text-[11px]" style={{ color: theme.ui.textMuted }}>
            {syncConfig.github.lastSyncedAt && activeTab === 'github'
              ? `Last synced: ${new Date(syncConfig.github.lastSyncedAt).toLocaleString()}`
              : syncConfig.overleaf.lastSyncedAt && activeTab === 'overleaf'
                ? `Last synced: ${new Date(syncConfig.overleaf.lastSyncedAt).toLocaleString()}`
                : syncConfig.easytex.lastSyncedAt && activeTab === 'easytex'
                  ? `Last synced: ${new Date(syncConfig.easytex.lastSyncedAt).toLocaleString()}`
                  : `${project.files.length} file(s) in "${project.name}"`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-md"
            style={{ backgroundColor: theme.ui.accent, color: theme.ui.accentFg }}
          >
            Done
          </button>
        </>
      }
    >
      {statusMessage && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          {publishedActionsUrl && (
            <a
              href={publishedActionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline whitespace-nowrap"
            >
              Open Actions
            </a>
          )}
        </div>
      )}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
          {errorMessage}
        </div>
      )}

      {activeTab === 'github' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs" style={{ color: theme.ui.textMuted }}>
              {syncConfig.github.connected
                ? `Connected as @${syncConfig.github.username || 'user'}`
                : 'Connect with GitHub OAuth or a Personal Access Token (repo scope).'}
            </div>
            <button
              type="button"
              onClick={handleGithubOAuth}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border"
              style={{
                borderColor: theme.ui.border,
                backgroundColor: theme.ui.surface,
                color: theme.ui.text,
              }}
            >
              <Github className="w-3.5 h-3.5" />
              Connect GitHub OAuth
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label htmlFor="gh-pat" className="block text-xs font-medium mb-1" style={{ color: theme.ui.textMuted }}>
                GitHub Personal Access Token
              </label>
              <div className="flex gap-2">
                <input
                  id="gh-pat"
                  type="password"
                  value={syncConfig.github.token}
                  onChange={(e) =>
                    onUpdateSyncConfig({
                      ...syncConfig,
                      github: { ...syncConfig.github, token: e.target.value },
                    })
                  }
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="flex-1 px-3 py-1.5 text-xs font-mono rounded-md border"
                  style={{
                    backgroundColor: theme.ui.surface,
                    borderColor: theme.ui.border,
                    color: theme.ui.text,
                  }}
                />
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => fetchGithubRepos()}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border whitespace-nowrap"
                  style={{
                    borderColor: theme.ui.border,
                    backgroundColor: theme.ui.surface,
                    color: theme.ui.text,
                  }}
                >
                  Verify &amp; List Repos
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="gh-repo" className="block text-xs font-medium mb-1" style={{ color: theme.ui.textMuted }}>
                Repository (owner/repo)
              </label>
              {ghRepos.length > 0 ? (
                <select
                  id="gh-repo"
                  value={syncConfig.github.repo}
                  onChange={(e) =>
                    onUpdateSyncConfig({
                      ...syncConfig,
                      github: { ...syncConfig.github, repo: e.target.value },
                    })
                  }
                  className="w-full px-3 py-1.5 text-xs rounded-md border"
                  style={{
                    backgroundColor: theme.ui.surface,
                    borderColor: theme.ui.border,
                    color: theme.ui.text,
                  }}
                >
                  {ghRepos.map((r) => (
                    <option key={r.fullName} value={r.fullName}>
                      {r.fullName}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="gh-repo"
                  type="text"
                  value={syncConfig.github.repo}
                  onChange={(e) =>
                    onUpdateSyncConfig({
                      ...syncConfig,
                      github: { ...syncConfig.github, repo: e.target.value },
                    })
                  }
                  placeholder="username/latex-thesis"
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-md border"
                  style={{
                    backgroundColor: theme.ui.surface,
                    borderColor: theme.ui.border,
                    color: theme.ui.text,
                  }}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="gh-branch" className="block text-xs font-medium mb-1" style={{ color: theme.ui.textMuted }}>
                  Branch
                </label>
                <input
                  id="gh-branch"
                  type="text"
                  value={syncConfig.github.branch}
                  onChange={(e) =>
                    onUpdateSyncConfig({
                      ...syncConfig,
                      github: { ...syncConfig.github, branch: e.target.value },
                    })
                  }
                  placeholder="main"
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md border"
                  style={{
                    backgroundColor: theme.ui.surface,
                    borderColor: theme.ui.border,
                    color: theme.ui.text,
                  }}
                />
              </div>
              <div>
                <label htmlFor="gh-path" className="block text-xs font-medium mb-1" style={{ color: theme.ui.textMuted }}>
                  Subfolder
                </label>
                <input
                  id="gh-path"
                  type="text"
                  value={syncConfig.github.basePath}
                  onChange={(e) =>
                    onUpdateSyncConfig({
                      ...syncConfig,
                      github: { ...syncConfig.github, basePath: e.target.value },
                    })
                  }
                  placeholder="(root)"
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md border"
                  style={{
                    backgroundColor: theme.ui.surface,
                    borderColor: theme.ui.border,
                    color: theme.ui.text,
                  }}
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="gh-commit" className="block text-xs font-medium mb-1" style={{ color: theme.ui.textMuted }}>
                Commit Message
              </label>
              <input
                id="gh-commit"
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-md border"
                style={{
                  backgroundColor: theme.ui.surface,
                  borderColor: theme.ui.border,
                  color: theme.ui.text,
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={handleGithubPull}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md border"
              style={{
                borderColor: theme.ui.border,
                backgroundColor: theme.ui.surface,
                color: theme.ui.text,
              }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Pull Files
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={handleGithubPush}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md"
              style={{
                backgroundColor: theme.ui.accent,
                color: theme.ui.accentFg,
              }}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Push &amp; Save Project
            </button>
          </div>

          {/* Publish TeXcellent App & Desktop Installers CI Workflow */}
          <div
            className="p-3.5 rounded-lg border space-y-3"
            style={{ backgroundColor: theme.ui.surface, borderColor: theme.ui.border }}
          >
            <div>
              <div className="text-xs font-semibold">
                Publish TeXcellent App &amp; Desktop Installers (AppImage, .exe, macOS)
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: theme.ui.textMuted }}>
                Push TeXcellent&apos;s source + CI workflow (<code className="font-mono">.github/workflows/build-desktop.yml</code>) and trigger a manual release tag build from GitHub Actions.
              </p>
            </div>

            <div className="flex items-end flex-wrap gap-2">
              <div className="flex-1 min-w-[160px]">
                <label htmlFor="gh-new-repo" className="block text-[11px] font-medium mb-1" style={{ color: theme.ui.textMuted }}>
                  New Repository Name
                </label>
                <input
                  id="gh-new-repo"
                  type="text"
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                  placeholder="TeXcellent"
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md border"
                  style={{
                    backgroundColor: theme.ui.bg,
                    borderColor: theme.ui.border,
                    color: theme.ui.text,
                  }}
                />
              </div>
              <label className="inline-flex items-center gap-1.5 text-xs pb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newRepoPrivate}
                  onChange={(e) => setNewRepoPrivate(e.target.checked)}
                />
                Private
              </label>
              <button
                type="button"
                disabled={isBusy}
                onClick={handleCreateGithubRepo}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border whitespace-nowrap"
                style={{
                  borderColor: theme.ui.border,
                  backgroundColor: theme.ui.bg,
                  color: theme.ui.text,
                }}
              >
                <FolderPlus className="w-3.5 h-3.5" />
                Create Repo
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={handlePublishTeXcellentApp}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap"
                style={{
                  backgroundColor: theme.ui.accent,
                  color: theme.ui.accentFg,
                }}
              >
                <Rocket className="w-3.5 h-3.5" />
                Publish App + Workflows
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'overleaf' && (
        <div className="space-y-4">
          <p className="text-xs" style={{ color: theme.ui.textMuted }}>
            Sync directly via Overleaf&apos;s Git Bridge (<code className="font-mono">git.overleaf.com</code>), open your current document directly in Overleaf, or export an Overleaf-ready archive.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="ol-project-id" className="block text-xs font-medium mb-1" style={{ color: theme.ui.textMuted }}>
                Overleaf Project ID
              </label>
              <input
                id="ol-project-id"
                type="text"
                value={syncConfig.overleaf.projectId}
                onChange={(e) =>
                  onUpdateSyncConfig({
                    ...syncConfig,
                    overleaf: { ...syncConfig.overleaf, projectId: e.target.value },
                  })
                }
                placeholder="65f1a2b3c4d5e6f7a8b9c0d1"
                className="w-full px-3 py-1.5 text-xs font-mono rounded-md border"
                style={{
                  backgroundColor: theme.ui.surface,
                  borderColor: theme.ui.border,
                  color: theme.ui.text,
                }}
              />
            </div>
            <div>
              <label htmlFor="ol-git-token" className="block text-xs font-medium mb-1" style={{ color: theme.ui.textMuted }}>
                Overleaf Git Authentication Token
              </label>
              <input
                id="ol-git-token"
                type="password"
                value={syncConfig.overleaf.gitToken}
                onChange={(e) =>
                  onUpdateSyncConfig({
                    ...syncConfig,
                    overleaf: { ...syncConfig.overleaf, gitToken: e.target.value },
                  })
                }
                placeholder="olp_xxxxxxxxxxxx"
                className="w-full px-3 py-1.5 text-xs font-mono rounded-md border"
                style={{
                  backgroundColor: theme.ui.surface,
                  borderColor: theme.ui.border,
                  color: theme.ui.text,
                }}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="ol-host" className="block text-xs font-medium mb-1" style={{ color: theme.ui.textMuted }}>
                Overleaf Git Host (Overleaf Cloud or Community Edition)
              </label>
              <input
                id="ol-host"
                type="url"
                value={syncConfig.overleaf.customHost}
                onChange={(e) =>
                  onUpdateSyncConfig({
                    ...syncConfig,
                    overleaf: { ...syncConfig.overleaf, customHost: e.target.value },
                  })
                }
                placeholder="https://git.overleaf.com"
                className="w-full px-3 py-1.5 text-xs font-mono rounded-md border"
                style={{
                  backgroundColor: theme.ui.surface,
                  borderColor: theme.ui.border,
                  color: theme.ui.text,
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
            <div className="flex items-center gap-2">
              <form
                action="https://www.overleaf.com/docs"
                method="post"
                target="_blank"
                rel="noopener noreferrer"
              >
                <input type="hidden" name="snip" value={mainFile?.content || ''} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border"
                  style={{
                    borderColor: theme.ui.border,
                    backgroundColor: theme.ui.surface,
                    color: theme.ui.text,
                  }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in Overleaf
                </button>
              </form>
              <button
                type="button"
                onClick={() => handleDownloadProjectZip('overleaf')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border"
                style={{
                  borderColor: theme.ui.border,
                  backgroundColor: theme.ui.surface,
                  color: theme.ui.text,
                }}
              >
                <Download className="w-3.5 h-3.5" />
                Export ZIP
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleOverleafSync('verify')}
                className="px-3 py-1.5 text-xs font-medium rounded-md border"
                style={{
                  borderColor: theme.ui.border,
                  backgroundColor: theme.ui.surface,
                  color: theme.ui.text,
                }}
              >
                Verify
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleOverleafSync('pull')}
                className="px-3 py-1.5 text-xs font-medium rounded-md border"
                style={{
                  borderColor: theme.ui.border,
                  backgroundColor: theme.ui.surface,
                  color: theme.ui.text,
                }}
              >
                Pull
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleOverleafSync('push')}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md"
                style={{
                  backgroundColor: theme.ui.accent,
                  color: theme.ui.accentFg,
                }}
              >
                <Cloud className="w-3.5 h-3.5" />
                Push to Overleaf
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'easytex' && (
        <div className="space-y-4">
          <p className="text-xs" style={{ color: theme.ui.textMuted }}>
            Connect to your <span className="font-mono">easytex.ir</span> XePersian workspace to sync Persian &amp; academic TeX documents or export a ready-to-upload XeLaTeX bundle.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="et-instance" className="block text-xs font-medium mb-1" style={{ color: theme.ui.textMuted }}>
                easytex.ir Instance URL
              </label>
              <input
                id="et-instance"
                type="url"
                value={syncConfig.easytex.instanceUrl}
                onChange={(e) =>
                  onUpdateSyncConfig({
                    ...syncConfig,
                    easytex: { ...syncConfig.easytex, instanceUrl: e.target.value },
                  })
                }
                placeholder="https://easytex.ir"
                className="w-full px-3 py-1.5 text-xs font-mono rounded-md border"
                style={{
                  backgroundColor: theme.ui.surface,
                  borderColor: theme.ui.border,
                  color: theme.ui.text,
                }}
              />
            </div>
            <div>
              <label htmlFor="et-project" className="block text-xs font-medium mb-1" style={{ color: theme.ui.textMuted }}>
                Project URL or ID
              </label>
              <input
                id="et-project"
                type="text"
                value={syncConfig.easytex.projectUrl}
                onChange={(e) =>
                  onUpdateSyncConfig({
                    ...syncConfig,
                    easytex: { ...syncConfig.easytex, projectUrl: e.target.value },
                  })
                }
                placeholder="https://easytex.ir/project/..."
                className="w-full px-3 py-1.5 text-xs font-mono rounded-md border"
                style={{
                  backgroundColor: theme.ui.surface,
                  borderColor: theme.ui.border,
                  color: theme.ui.text,
                }}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="et-token" className="block text-xs font-medium mb-1" style={{ color: theme.ui.textMuted }}>
                API Token or Session Cookie (Optional for public/browser export)
              </label>
              <input
                id="et-token"
                type="password"
                value={syncConfig.easytex.apiToken}
                onChange={(e) =>
                  onUpdateSyncConfig({
                    ...syncConfig,
                    easytex: { ...syncConfig.easytex, apiToken: e.target.value },
                  })
                }
                placeholder="Bearer token or sharelatex.sid=..."
                className="w-full px-3 py-1.5 text-xs font-mono rounded-md border"
                style={{
                  backgroundColor: theme.ui.surface,
                  borderColor: theme.ui.border,
                  color: theme.ui.text,
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={() => handleDownloadProjectZip('easytex-xepersian')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border"
              style={{
                borderColor: theme.ui.border,
                backgroundColor: theme.ui.surface,
                color: theme.ui.text,
              }}
            >
              <Download className="w-3.5 h-3.5" />
              Download XePersian ZIP
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleEasyTexSync('test')}
                className="px-3 py-1.5 text-xs font-medium rounded-md border"
                style={{
                  borderColor: theme.ui.border,
                  backgroundColor: theme.ui.surface,
                  color: theme.ui.text,
                }}
              >
                Test Connection
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleEasyTexSync('push')}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md"
                style={{
                  backgroundColor: theme.ui.accent,
                  color: theme.ui.accentFg,
                }}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                Sync to easytex.ir
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'archive' && (
        <div className="space-y-4">
          <p className="text-xs" style={{ color: theme.ui.textMuted }}>
            Import <code className="font-mono">.tex</code>, <code className="font-mono">.bib</code>, <code className="font-mono">.sty</code>, <code className="font-mono">.cls</code>, or <code className="font-mono">.zip</code> packages directly into &ldquo;{project.name}&rdquo;, or export a portable archive.
          </p>

          <input
            ref={importInputRef}
            type="file"
            accept=".zip,.tex,.bib,.sty,.cls"
            multiple
            onChange={handleImportProjectFiles}
            className="hidden"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              className="p-4 rounded-lg border space-y-3"
              style={{ backgroundColor: theme.ui.surface, borderColor: theme.ui.border }}
            >
              <div>
                <div className="text-xs font-semibold">Import Project Archive</div>
                <p className="text-[11px] mt-1" style={{ color: theme.ui.textMuted }}>
                  Merge source files or unzip an Overleaf / easytex.ir export into the active project.
                </p>
              </div>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => importInputRef.current?.click()}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border"
                style={{
                  borderColor: theme.ui.border,
                  backgroundColor: theme.ui.bg,
                  color: theme.ui.text,
                }}
              >
                <Upload className="w-3.5 h-3.5" style={{ color: theme.ui.accent }} />
                Choose .zip / .tex / .bib Files
              </button>
            </div>

            <div
              className="p-4 rounded-lg border space-y-3"
              style={{ backgroundColor: theme.ui.surface, borderColor: theme.ui.border }}
            >
              <div>
                <div className="text-xs font-semibold">Export Project Archive</div>
                <p className="text-[11px] mt-1" style={{ color: theme.ui.textMuted }}>
                  Download all {project.files.length} source and image assets in &ldquo;{project.name}&rdquo; as a single <code className="font-mono">.zip</code>.
                </p>
              </div>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleDownloadProjectZip('texcellent')}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md"
                style={{
                  backgroundColor: theme.ui.accent,
                  color: theme.ui.accentFg,
                }}
              >
                <Download className="w-3.5 h-3.5" />
                Export Project (.zip)
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalShell>
  );
};
