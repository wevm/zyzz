/**
 * Configures repository formatting, lint, integration tests, and coverage.
 * @module
 */
import * as Path from 'node:path'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  fmt: {
    ignorePatterns: [
      '.fixture-*/**',
      'dist/**',
      'node_modules/**',
      'pnpm-lock.yaml',
    ],
    printWidth: 80,
    semi: false,
    singleQuote: true,
    sortPackageJson: false,
  },
  lint: {
    categories: { correctness: 'error' },
    ignorePatterns: ['.fixture-*/**', 'dist/**', 'node_modules/**'],
    options: { typeAware: true, typeCheck: true },
    rules: { 'no-unused-vars': 'error' },
  },
  test: {
    alias: {
      zyzz: Path.resolve(import.meta.dirname, 'src'),
    },
    coverage: {
      exclude: ['src/**/*.bench.ts', 'src/**/*.test-d.ts', 'src/**/*.test.ts'],
      include: ['src/**/*.ts'],
      provider: 'v8',
      reporter: ['json', 'json-summary', 'text'],
      reportOnFailure: true,
    },
    globals: true,
  },
})
