/** Verifies production theme colours across Vite CSS processing modes. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import * as Vite from 'vite'
import { describe, expect, test } from 'vite-plus/test'
import { zyzz } from 'zyzz/vite'

describe('zyzz', () => {
  test.each([
    ['postcss', false],
    ['postcss', 'esbuild'],
    ['postcss', 'lightningcss'],
    ['lightningcss', false],
    ['lightningcss', 'esbuild'],
    ['lightningcss', 'lightningcss'],
  ] as const)(
    'preserves inline theme schemes with %s processing and %s minification',
    async (transformer, cssMinify) => {
      const root = await Fs.mkdtemp(Path.resolve('.fixture-theme-scheme-'))
      const browser = await chromium.launch()
      let server: Vite.PreviewServer | undefined

      try {
        await Fs.writeFile(
          Path.join(root, 'index.html'),
          '<script type="module" src="/main.ts"></script>',
        )
        await Fs.writeFile(
          Path.join(root, 'main.ts'),
          `
import { Config, Theme } from 'zyzz'
const base = Theme.define({ color: { surface: { light: '#ffffff', dark: '#202029' }, text: { light: '#20202a', dark: '#f4f4f8' } } })
const { css, themes } = Config.create({ defaultTheme: 'base', themes: { base } })
const card = css({ backgroundColor: 'surface', color: 'text', border: '1px solid', borderColor: 'text' })
const scope = themes({ theme: 'base', colorScheme: 'light' })
const props = card()
document.body.innerHTML = '<main class="' + scope.className + '"><div id="card" class="' + props.className + '">Theme</div></main>'
Object.assign(document.querySelector('main').style, scope.style)
`,
        )
        const config: Vite.InlineConfig = {
          build: { cssMinify, cssTarget: ['chrome120'] },
          configFile: false,
          css: {
            transformer,
            lightningcss: { targets: { chrome: 120 << 16 } },
          },
          logLevel: 'silent',
          plugins: [zyzz()],
          root,
        }

        await Vite.build(config)
        server = await Vite.preview({
          ...config,
          preview: { host: '127.0.0.1', port: 0 },
        })
        const page = await browser.newPage()
        await page.goto(server.resolvedUrls!.local[0]!)
        await page.waitForSelector('#card')

        for (const scheme of ['light', 'dark', 'light']) {
          await page.locator('main').evaluate((element, value) => {
            element.style.colorScheme = value
          }, scheme)
          const actual = await page.locator('#card').evaluate((element) => {
            const style = getComputedStyle(element)
            return [
              style.backgroundColor,
              style.color,
              style.borderTopColor,
              style.borderRightColor,
            ]
          })

          if (scheme === 'dark')
            expect(actual).toMatchInlineSnapshot(`
              [
                "rgb(32, 32, 41)",
                "rgb(244, 244, 248)",
                "rgb(244, 244, 248)",
                "rgb(244, 244, 248)",
              ]
            `)
          else
            expect(actual).toMatchInlineSnapshot(`
              [
                "rgb(255, 255, 255)",
                "rgb(32, 32, 42)",
                "rgb(32, 32, 42)",
                "rgb(32, 32, 42)",
              ]
            `)
        }
      } finally {
        await browser.close()
        if (server)
          await new Promise<void>((resolve, reject) =>
            server!.httpServer.close((error) =>
              error ? reject(error) : resolve(),
            ),
          )
        await Fs.rm(root, { recursive: true, force: true })
      }
    },
  )
})
