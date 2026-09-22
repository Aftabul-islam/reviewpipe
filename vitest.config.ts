import { fileURLToPath } from 'node:url';
import { defineConfig, configDefaults } from 'vitest/config';

// Resolve workspace packages to their TypeScript source so tests run without a
// build step; the published packages still point at dist via their package.json.
const pkg = (name: string): string =>
  fileURLToPath(new URL(`packages/${name}/src/index.ts`, import.meta.url));

export const workspaceAlias: Record<string, string> = {
  '@reviewpipe/core': pkg('core'),
  '@reviewpipe/provider-lexicon': pkg('provider-lexicon'),
  '@reviewpipe/provider-local': pkg('provider-local'),
  '@reviewpipe/adapter-csv': pkg('adapter-csv'),
  '@reviewpipe/adapter-json': pkg('adapter-json'),
  '@reviewpipe/exporter-json': pkg('exporter-json'),
  '@reviewpipe/exporter-csv': pkg('exporter-csv'),
  '@reviewpipe/clustering': pkg('clustering'),
};

export default defineConfig({
  resolve: { alias: workspaceAlias },
  // Integration tests download real models; they run only via `pnpm test:integration`.
  test: { exclude: [...configDefaults.exclude, '**/*.integration.test.ts'] },
});
