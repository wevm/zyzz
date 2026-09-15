/** Connects the Solid playground to Zyzz compilation. @module */
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { zyzz } from 'zyzz/vite'

export default defineConfig({
  plugins: [zyzz(), solid()],
})
