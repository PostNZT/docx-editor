import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

const monorepoRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  plugins: [vue()],
  root: __dirname,
  resolve: {
    alias: [
      {
        find: '@postnzt/docx-editor-vue',
        replacement: path.join(monorepoRoot, 'packages/vue/src/index.ts'),
      },
      {
        find: '@postnzt/docx-core/headless',
        replacement: path.join(monorepoRoot, 'packages/core/src/headless.ts'),
      },
      {
        find: '@postnzt/docx-core/core-plugins',
        replacement: path.join(monorepoRoot, 'packages/core/src/core-plugins/index.ts'),
      },
      // Wildcard alias for deep core imports
      {
        find: /^@postnzt\/docx-core\/(.+)/,
        replacement: path.join(monorepoRoot, 'packages/core/src/$1'),
      },
      // Exact match for bare @postnzt/docx-core (must come AFTER prefix match)
      {
        find: /^@postnzt\/docx-core$/,
        replacement: path.join(monorepoRoot, 'packages/core/src/core.ts'),
      },
    ],
  },
  server: {
    port: 5174,
    open: false,
  },
  build: {
    outDir: 'dist',
  },
});
