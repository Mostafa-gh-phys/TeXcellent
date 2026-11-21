const ALLOWED_ROOT_FILES = new Set([
  '.env.example',
  '.gitignore',
  'electron-builder.yml',
  'index.html',
  'metadata.json',
  'package.json',
  'server.ts',
  'tsconfig.json',
  'vite.config.ts',
]);

const ALLOWED_DIR_PREFIXES = [
  '.github/workflows/',
  'electron/',
  'packaging/',
  'public/',
  'scripts/',
  'src/',
];

const BLOCKED_DIR_PREFIXES = [
  'public/assets/aistudio/',
];

const BLOCKED_EXTENSIONS = /\.(?:aux|bbl|bcf|blg|db|fdb_latexmk|fls|log|nav|out|pdf|run\.xml|snm|sqlite|sqlite3|synctex|synctex\.gz|toc|zip)$/i;

/**
 * Strict allowlist filter for `/api/github/publish-app`.
 * Guarantees user LaTeX projects, compiled outputs, secrets, and local artifacts
 * can never be collected from disk and pushed to a public/shared GitHub repository.
 */
export function shouldIncludeAppPublishFile(rawRelPath: string): boolean {
  const rel = rawRelPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rel || rel.includes('..')) return false;

  const baseName = rel.split('/').pop() || '';
  if (!baseName) return false;
  if (baseName.startsWith('.env') && rel !== '.env.example') return false;
  if (baseName === '.DS_Store' || baseName === 'Thumbs.db' || baseName === 'package-lock.json') {
    return false;
  }

  for (const blocked of BLOCKED_DIR_PREFIXES) {
    if (rel === blocked.slice(0, -1) || rel.startsWith(blocked)) {
      return false;
    }
  }

  if (BLOCKED_EXTENSIONS.test(baseName)) {
    return false;
  }

  if (ALLOWED_ROOT_FILES.has(rel)) {
    return true;
  }

  return ALLOWED_DIR_PREFIXES.some((prefix) => rel.startsWith(prefix));
}
