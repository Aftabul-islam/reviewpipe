// Copies the root LICENSE and NOTICE into the current package directory so each
// published tarball carries them. Run from a package dir via its prepack script.
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const file of ['LICENSE', 'NOTICE']) {
  copyFileSync(join(repoRoot, file), file);
}
