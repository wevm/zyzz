/** Bundles the compiled tree with Zyzz's browser target defaults. @module */
import { defineConfig } from 'vite'
import { targets } from 'zyzz/vite'

export default defineConfig({
  plugins: [targets()],
})
