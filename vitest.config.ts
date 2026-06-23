import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/orphaned-routers-integration.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    teardownTimeout: 10_000,
    retry: 2,
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/types/**',
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/__mocks__/**',
        'src/index.ts',
        'src/db.ts',
        'src/config.ts',
      ],
      reporter: ['text', 'text-summary', 'lcov', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: {
        statements: 65,
        branches: 55,
        functions: 60,
        lines: 65,
      },
    },
  },
});
