/** Inlines the compiled initialization script before any other script in index.html. @module */
import { defineConfig } from 'vite'

// The compiled tree is a build artifact, so the configuration module loads through a runtime URL.
const compiled = (await import(
  new URL('./.zyzz/zyzz.config.ts', import.meta.url).href
)) as { script: () => string }

export default defineConfig({
  plugins: [
    {
      name: 'zyzz-initialization',
      transformIndexHtml: () => [
        {
          children: compiled.script(),
          injectTo: 'head-prepend',
          tag: 'script',
        },
      ],
    },
  ],
})
