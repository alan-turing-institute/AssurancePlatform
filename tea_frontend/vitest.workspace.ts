import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // Unit tests configuration
  {
    extends: './vitest.config.ts',
    test: {
      name: 'unit',
      include: ['**/*.{test,spec}.{ts,tsx}'],
      exclude: [
        '**/*.integration.{test,spec}.{ts,tsx}',
        '**/*.e2e.{test,spec}.{ts,tsx}',
      ],
    },
  },
  // Integration tests configuration
  {
    extends: './vitest.config.ts',
    test: {
      name: 'integration',
      include: ['**/*.integration.{test,spec}.{ts,tsx}'],
      setupFiles: ['./src/__tests__/setup.integration.tsx'],
      testTimeout: 30000, // Longer timeout for integration tests
    },
  },
  // E2E tests configuration
  {
    extends: './vitest.config.ts',
    test: {
      name: 'e2e',
      include: ['**/*.e2e.{test,spec}.{ts,tsx}'],
      setupFiles: ['./src/__tests__/setup.e2e.tsx'],
      testTimeout: 60000, // Even longer timeout for e2e tests
      // Run e2e tests sequentially
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
    },
  },
]);
