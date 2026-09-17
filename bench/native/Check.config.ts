/** Runs native benchmark fixture validation only in the Benchmarks workflow. @module */
import { defineConfig } from 'vite-plus'
export default defineConfig({
  test: { include: ['bench/native/Check.test.ts'] },
})
