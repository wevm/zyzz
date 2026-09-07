import * as Path from 'node:path'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  test: {
    alias: {
      typestyle: Path.resolve(import.meta.dirname, 'src'),
    },
    globals: true,
  },
  lint: {
    categories: { correctness: 'error' },
    ignorePatterns: ['dist/**', 'node_modules/**', '.fixture-*/**'],
    options: { typeAware: true, typeCheck: true },
    rules: { 'no-unused-vars': 'error' },
  },
  fmt: {
    ignorePatterns: [
      'dist/**',
      'node_modules/**',
      '.fixture-*/**',
      'pnpm-lock.yaml',
    ],
    printWidth: 80,
    semi: false,
    singleQuote: true,
    sortPackageJson: false,
  },
})
