import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Tests import native/ audio cues and fitBoardCell. Do not walk into
  // native/tsconfig.json (extends expo/tsconfig.base, not installed at root).
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
