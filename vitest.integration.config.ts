import { defineConfig } from 'vitest/config';
import { workspaceAlias } from './vitest.config';

// Runs ONLY the integration tests (real model downloads), invoked via
// `pnpm test:integration`. Requires the optional peer deps to be installed.
export default defineConfig({
  resolve: { alias: workspaceAlias },
  test: {
    include: ['packages/**/*.integration.test.ts'],
    testTimeout: 120_000,
  },
});
