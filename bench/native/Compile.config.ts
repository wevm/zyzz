/** Isolates native compilation measurements in the Benchmarks workflow. @module */
import { defineConfig } from 'vite-plus'
export default defineConfig({
  test: {
    env: { NODE_ENV: 'production' },
    benchmark: {
      include: ['bench/native/Compile.bench.ts', 'bench/native/Cold.bench.ts'],
    },
  },
})
