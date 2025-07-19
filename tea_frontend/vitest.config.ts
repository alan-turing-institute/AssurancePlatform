import path from 'node:path';
import react from '@vitejs/plugin-react';
import type { InlineConfig } from 'vitest';
import { defineConfig } from 'vitest/config';

const testConfig: InlineConfig = {
  environment: 'jsdom',
  setupFiles: ['./src/__tests__/setup.tsx'],
  globals: true,
  css: true,

  // Configure parallel execution
  pool: 'threads',
  poolOptions: {
    threads: {
      singleThread: false,
      minThreads: 1,
      maxThreads: 8,
      // Use available CPUs but leave some for other processes
      useAtomics: true,
      isolate: true,
    },
  },

  // Test categorization and filtering
  include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', 'tea-docs/**'],

  // Test timeout configuration
  testTimeout: 20000, // 20 seconds
  hookTimeout: 10000, // 10 seconds
  teardownTimeout: 5000, // 5 seconds

  // Retry configuration for flaky tests
  retry: 2,

  // Multiple reporters configuration
  reporters: process.env.CI
    ? ['default', ['junit', { outputFile: './test-results/junit.xml' }]]
    : ['default'],

  // Optimized coverage collection
  coverage: {
    enabled: process.env.CI === 'true' || process.env.COVERAGE === 'true',
    provider: 'v8',
    reporter: ['text', 'json', 'html', 'lcov'],
    exclude: [
      'node_modules/**',
      'src/__tests__/**',
      '**/*.d.ts',
      '**/*.config.{js,ts,mjs,cjs}',
      'src/types/**',
      '.next/**',
      'public/**',
      'logs/**',
      'tea-docs/**',
      'coverage/**',
      'dist/**',
      '**/*.spec.{js,ts,jsx,tsx}',
      '**/*.test.{js,ts,jsx,tsx}',
    ],
    include: [
      'app/**',
      'components/**',
      'hooks/**',
      'lib/**',
      'actions/**',
      'providers/**',
    ],
    all: true,
    clean: true,
    skipFull: false,
    thresholds: {
      global: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },

  // Performance optimizations
  maxConcurrency: 5,
  passWithNoTests: false,
  allowOnly: process.env.CI !== 'true',
  dangerouslyIgnoreUnhandledErrors: false,

  // Better error output
  outputFile: process.env.CI ? './test-results/output.json' : undefined,
};

export default defineConfig({
  plugins: [react()],
  test: testConfig,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/components': path.resolve(__dirname, './components'),
      '@/hooks': path.resolve(__dirname, './hooks'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@/types': path.resolve(__dirname, './types'),
      '@/actions': path.resolve(__dirname, './actions'),
      '@/providers': path.resolve(__dirname, './providers'),
      '@/app': path.resolve(__dirname, './app'),
      '@/config': path.resolve(__dirname, './config'),
      '@/data': path.resolve(__dirname, './data'),
      '@/public': path.resolve(__dirname, './public'),
    },
  },
  // Optimization for module resolution
  optimizeDeps: {
    include: ['react', 'react-dom', '@testing-library/react'],
  },
});
