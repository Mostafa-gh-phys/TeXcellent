import { ensureDesktopIcons } from './desktop-icons-lib.mjs';

const result = ensureDesktopIcons(process.cwd(), 'packaging');
console.log(
  `[ensure-desktop-icons] Prepared icons in ${result.outDir} from ${result.sourcePath} (${result.sizes.join(', ')} px)`
);
