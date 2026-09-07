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
      typestyle: Path.resolve(import.meta.dirname, 'src'),
    },
    globals: true,
  },
})
