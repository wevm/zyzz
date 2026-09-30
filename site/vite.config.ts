/** Configures TanStack Start for Cloudflare Workers. @module */
import { cloudflare } from '@cloudflare/vite-plugin'
import babel from '@rolldown/plugin-babel'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { codeToTokensWithThemes } from 'shiki'
import Icons from 'unplugin-icons/vite'
import { defineConfig } from 'vite'
import { zyzz } from 'zyzz/vite'
import { files, lightTheme, theme } from './src/Example.js'

export default defineConfig(async () => {
  const examples = await Promise.all(
    files.map(async (file) => {
      const tokens = await codeToTokensWithThemes(file.code, {
        lang: file.lang,
        themes: { light: lightTheme, dark: theme },
      })
      return {
        name: file.name,
        tokens: tokens.map((line) =>
          line.map(({ content, variants }) => ({
            content,
            color: `light-dark(${variants.light?.color ?? lightTheme.fg}, ${variants.dark?.color ?? theme.fg})`,
          })),
        ),
      }
    }),
  )
  return {
    define: {
      __EXAMPLE__: JSON.stringify({
        bg: `light-dark(${lightTheme.bg}, ${theme.bg})`,
        fg: `light-dark(${lightTheme.fg}, ${theme.fg})`,
        files: examples,
      }),
    },
    plugins: [
      cloudflare({ viteEnvironment: { name: 'ssr' } }),
      zyzz(),
      Icons({ compiler: 'jsx', jsx: 'react' }),
      tanstackStart(),
      react(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
  }
})
