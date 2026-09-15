/** Inlines the compiled initialization script before any other script in index.html. @module */
import { defineConfig } from 'vite'

// The compiled tree is a build artifact, so the configuration module loads through a runtime URL.
const compiled = new URL('./.zyzz/zyzz.config.ts', import.meta.url).href

export default defineConfig({
  plugins: [
    {
      name: 'zyzz-initialization',
      async transformIndexHtml() {
        // `zyzz dev` republishes the configuration, so each document loads the current catalog.
        const module = (await import(`${compiled}?t=${Date.now()}`)) as {
          script: () => string
        }

        return [
          {
            children: module.script(),
            injectTo: 'head-prepend',
            tag: 'script',
          },
        ]
      },
    },
  ],
})
