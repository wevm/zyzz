/** Connects the Svelte playground to Zyzz compilation. @module */
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { zyzz } from 'zyzz/vite'

export default defineConfig({
  plugins: [zyzz(), svelte()],
})
