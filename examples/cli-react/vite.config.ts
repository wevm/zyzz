/** Bundles the compiled tree into a separate directory from the compiler output. @module */
import { defineConfig } from 'vite'

// `zyzz build` owns dist, so the site builds beside it.
export default defineConfig({ build: { outDir: 'build' } })
