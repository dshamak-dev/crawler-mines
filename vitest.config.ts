import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Root `npm test` is engine/store only. Never transform `native/` —
    // Pages CI runs this before `cd native && npm ci`, so expo/tsconfig.base
    // is not installed.
    exclude: ['**/node_modules/**', 'native/**'],
    server: {
      fs: {
        deny: ['**/native/**'],
      },
    },
  },
});
