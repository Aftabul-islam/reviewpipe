import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Resolve the workspace package to its TypeScript source so tests run without a
// build step; the published package still points at dist via its package.json.
export default defineConfig({
  resolve: {
    alias: {
      '@reviewpipe/core': fileURLToPath(
        new URL('packages/core/src/index.ts', import.meta.url),
      ),
    },
  },
});
