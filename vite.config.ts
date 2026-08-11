import { defineConfig } from 'vite';

export default defineConfig({
  base: '/the-lineage-engine/', // Required base URL path for GitHub Pages
  test: {
    globals: true,
    environment: 'node',
  },
} as any);
