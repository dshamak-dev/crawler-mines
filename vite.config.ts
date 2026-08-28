import { copyFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/crawler-mines/',
  plugins: [
    react(),
    {
      name: 'github-pages-spa-fallback',
      apply: 'build',
      writeBundle() {
        copyFileSync('dist/index.html', 'dist/404.html');
      },
    },
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  server: {
    host: true,
    port: 5173,
    strictPort: false,
  },
});
