/** Bundles the compiled tree without a Zyzz plugin. @module */
import { defineConfig } from 'vite'

export default defineConfig({
  // The Zyzz Vite plugin supplies these targets itself; here they keep light-dark() intact for inherited scheme changes.
  build: { cssTarget: ['chrome123', 'firefox120', 'safari17.5'] },
})
