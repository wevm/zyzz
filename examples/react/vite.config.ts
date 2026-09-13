/** Connects the React playground to Zyzz compilation. @module */
import { defaultClientConditions, defineConfig } from 'vite'
import { zyzz } from 'zyzz/vite'

export default defineConfig({
  // Keep native light-dark() paired with runtime color-scheme selection.
  build: { cssTarget: 'esnext' },
  plugins: [zyzz()],
  // Resolve package assets and runtime modules directly from source.
  resolve: { conditions: ['src', ...defaultClientConditions] },
})
