import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const srcBase = path.join(rootDir, 'node_modules', 'pdfjs-dist');
const distBase = path.join(rootDir, 'dist', 'pdfjs');

if (!fs.existsSync(path.join(rootDir, 'dist'))) {
  console.warn('[copy-pdfjs-assets] dist/ does not exist yet, skipping.');
  process.exit(0);
}

for (const folder of ['cmaps', 'standard_fonts', 'wasm']) {
  const fromDir = path.join(srcBase, folder);
  const toDir = path.join(distBase, folder);
  if (fs.existsSync(fromDir)) {
    fs.mkdirSync(toDir, { recursive: true });
    fs.cpSync(fromDir, toDir, { recursive: true, force: true });
  }
}

console.log('[copy-pdfjs-assets] Copied pdfjs-dist cmaps, standard_fonts, and wasm into dist/pdfjs/');
