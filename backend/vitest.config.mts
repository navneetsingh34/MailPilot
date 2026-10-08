import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only the TypeScript sources: `tsc` also emits compiled *.test.js files into dist/.
    include: ['src/**/*.test.ts'],
  },
});
