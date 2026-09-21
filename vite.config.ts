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
      'src/compiler/internal/ResetCss.ts',
      'src/internal/NativeProperties.ts',
      'src/react-native/internal/NativeSchema.ts',
    ],
    printWidth: 80,
    semi: false,
    singleQuote: true,
    sortPackageJson: false,
  },
  lint: {
    categories: { correctness: 'error' },
    ignorePatterns: [
      '.fixture-*/**',
      'dist/**',
      'node_modules/**',
      'src/compiler/internal/ResetCss.ts',
      'src/internal/NativeProperties.ts',
      'src/react-native/internal/NativeSchema.ts',
    ],
    // Formatting and linting stay syntax-only; check:types checks types.
    options: { typeAware: false, typeCheck: false },
    rules: { 'no-unused-vars': 'error' },
  },
  test: {
    benchmark: { exclude: ['bench/native/**', '**/node_modules/**'] },
    alias: {
      zyzz: Path.resolve(import.meta.dirname, 'src'),
    },
    coverage: {
      exclude: [
        'src/**/*.bench-d.ts',
        'src/**/*.bench.ts',
        'src/**/*.test-d.ts',
        'src/**/*.test.ts',
      ],
      include: ['src/**/*.ts'],
      provider: 'v8',
      reporter: ['json', 'json-summary', 'text'],
      reportOnFailure: true,
    },
    globals: true,
    include: ['scripts/**/*.test.ts', 'src/**/*.test.ts', 'test/**/*.test.ts'],
  },
})
