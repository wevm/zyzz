/** Configures TanStack Start for Cloudflare Workers. @module */
import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import Icons from 'unplugin-icons/vite'
import { defineConfig } from 'vite'
import { zyzz } from 'zyzz/vite'

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    zyzz(),
    Icons({ compiler: 'jsx', jsx: 'react' }),
    tanstackStart(),
    react(),
  ],
})
