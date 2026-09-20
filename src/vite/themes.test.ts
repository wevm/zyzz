/** Verifies production theme colours across Vite CSS processing modes. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Lightning from 'lightningcss'
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
      let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
      let server: Vite.PreviewServer | undefined

      try {
        browser = await chromium.launch()
        await Fs.writeFile(
          Path.join(root, 'index.html'),
          '<script type="module" src="/main.ts"></script>',
        )
        await Fs.writeFile(
          Path.join(root, 'main.ts'),
          "\nimport { Config, Vars } from 'zyzz'\nconst base = Vars.define({ color: { surface: { light: '#ffffff', dark: '#202029' }, text: { light: '#20202a', dark: '#f4f4f8' } } })\nconst { style, vars:themes } = Config.create({ defaultVars: 'base', vars: { base } })\nconst card = style({ backgroundColor: 'surface', color: 'text', border: '1px solid', borderColor: 'text' })\nconst scope = themes({ set:'base', colorScheme: 'light' })\nconst props = card()\ndocument.body.innerHTML = '<main class=\"' + scope.className + '\"><div id=\"card\" class=\"' + props.className + '\">Theme</div></main>'\nObject.assign(document.querySelector('main').style, scope.style)\n",
        )
        const config: Vite.InlineConfig = {
          build: { cssMinify, cssTarget: ['chrome123'] },
          configFile: false,
          css: {
            transformer,
            lightningcss: { targets: { chrome: 123 << 16 } },
          },
          logLevel: 'silent',
          plugins: [
            zyzz(),
            {
              name: 'application-css',
              config: () => ({
                css: {
                  lightningcss: {
                    exclude: 1,
                    include: Lightning.Features.LightDark,
                  },
                },
              }),
            },
          ],
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
        if (transformer === 'postcss' && cssMinify === false) {
          for (const overrides of [
            { build: { cssTarget: ['chrome120'] } },
            { css: { lightningcss: { targets: { chrome: 120 << 16 } } } },
          ]) {
            const result = await Vite.build(
              Vite.mergeConfig(config, overrides),
            ).then(
              () => 'built',
              (error: unknown) =>
                String(error).includes(
                  'Zyzz theme colours require native light-dark() support.',
                ),
            )
            expect(result).toMatchInlineSnapshot('true')
          }
        }
      } finally {
        try {
          await browser?.close()
        } finally {
          try {
            if (server)
              await new Promise<void>((resolve, reject) =>
                server!.httpServer.close((error) =>
                  error ? reject(error) : resolve(),
                ),
              )
          } finally {
            await Fs.rm(root, { recursive: true, force: true })
          }
        }
      }
    },
    30000,
  )
  test.each(['chrome120', 'es2015', 'es2020', 'esnext'])(
    'rejects unverifiable application CSS targets from a later plugin: %s',
    async (target) => {
      const root = await Fs.mkdtemp(Path.resolve('.fixture-application-theme-'))

      try {
        await Fs.writeFile(
          Path.join(root, 'index.html'),
          '<script type="module" src="/main.ts"></script>',
        )
        await Fs.writeFile(
          Path.join(root, 'main.ts'),
          "import './style.css'; import { style } from 'zyzz'; document.body.className = style({ padding: '1px' })().className",
        )
        await Fs.writeFile(
          Path.join(root, 'style.css'),
          'body { color: light-dark(black, white) }',
        )
        const config: Vite.InlineConfig = {
          configFile: false,
          css: { transformer: 'lightningcss' },
          logLevel: 'silent',
          plugins: [
            zyzz(),
            {
              name: 'application-target',
              config: () => ({ build: { target } }),
            },
          ],
          root,
        }

        if (target === 'chrome120')
          await expect(
            Vite.build(config),
          ).rejects.toThrowErrorMatchingInlineSnapshot(
            '[Error: Zyzz theme colours require native light-dark() support. Set CSS targets to Chrome/Edge 123+, Firefox 120+, or Safari/iOS 17.5+.]',
          )
        else {
          const result = await Vite.build(config).then(
            () => 'built',
            (error: unknown) => String(error).replace(target, '<target>'),
          )
          expect(result).toMatchInlineSnapshot(
            '"Error: Zyzz cannot verify light-dark() support for CSS target: <target>"',
          )
        }

        await Vite.build({ ...config, build: { cssTarget: 'chrome123' } })
      } finally {
        await Fs.rm(root, { recursive: true, force: true })
      }
    },
    30000,
  )
})
