/** Connects the React playground to Zyzz compilation. @module */
import { defineConfig } from 'vite'
import { zyzz } from 'zyzz/vite'

export default defineConfig({
  // Keep native light-dark() paired with runtime color-scheme selection.
  build: { cssTarget: 'esnext' },
  plugins: [zyzz()],
})
