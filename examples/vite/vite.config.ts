import { defineConfig } from 'vite'
import { typestyle } from '../../src/Vite.js'

export default defineConfig({
  root: new URL('.', import.meta.url).pathname,
  plugins: [typestyle()],
  build: { outDir: 'dist' },
})
