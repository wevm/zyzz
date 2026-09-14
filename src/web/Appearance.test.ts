/** Verifies root appearance restoration, selection, and persistence in Chromium. @module */
import * as Esbuild from 'esbuild'
import * as Http from 'node:http'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'

describe('create', () => {
  test('restores saved selections over defaults and persists changes on the root', async () => {
    const bundle = await Esbuild.build({
      stdin: {
        contents: `import { Selection } from 'zyzz/runtime';
import { Appearance } from 'zyzz/web';
const themes = Selection.create([['base', 'z_theme-base'], ['mint', 'z_theme-mint']]);
export const appearance = Appearance.create({ defaults: { colorScheme: 'light dark', theme: 'base' }, themes });
export const restored = appearance.restore();`,
        loader: 'ts',
        resolveDir: process.cwd(),
      },
      alias: {
        'zyzz/runtime': Path.resolve('src/runtime/index.ts'),
        'zyzz/web': Path.resolve('src/web/index.ts'),
      },
      bundle: true,
      format: 'iife',
      globalName: 'Fixture',
      write: false,
    })
    const markup = `<!doctype html><html class="external"><head><script>${bundle.outputFiles[0]!.text}</script></head><body></body></html>`
    const server = Http.createServer((_, response) => {
      response.setHeader('Content-Type', 'text/html')
      response.end(markup)
    })

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

    const address = server.address() as { port: number }
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined

    try {
      browser = await chromium.launch({ headless: true })

      const page = await browser.newPage()

      await page.goto(`http://127.0.0.1:${address.port}/`)

      expect(await page.evaluate('Fixture.restored')).toMatchInlineSnapshot(`
        {
          "colorScheme": "light dark",
          "theme": "base",
        }
      `)
      expect(
        await page.evaluate('document.documentElement.className'),
      ).toMatchInlineSnapshot(`"external z_theme-base z_scheme-light-dark"`)
      expect(
        await page.evaluate('document.documentElement.style.colorScheme'),
      ).toMatchInlineSnapshot(`"light dark"`)

      await page.evaluate(
        "Fixture.appearance.select({ colorScheme: 'dark', theme: 'mint' })",
      )

      expect(
        await page.evaluate('document.documentElement.className'),
      ).toMatchInlineSnapshot(`"external z_theme-mint z_scheme-dark"`)
      expect(
        await page.evaluate("localStorage.getItem('zyzz')"),
      ).toMatchInlineSnapshot(`"{"colorScheme":"dark","theme":"mint"}"`)
      expect(await page.evaluate('Fixture.appearance.current()'))
        .toMatchInlineSnapshot(`
        {
          "colorScheme": "dark",
          "theme": "mint",
        }
      `)

      await page.reload()

      expect(await page.evaluate('Fixture.restored')).toMatchInlineSnapshot(`
        {
          "colorScheme": "dark",
          "theme": "mint",
        }
      `)

      await page.evaluate("Fixture.appearance.select({ theme: 'base' })")

      expect(
        await page.evaluate('document.documentElement.className'),
      ).toMatchInlineSnapshot(`"external z_theme-base"`)
      expect(
        await page.evaluate('document.documentElement.style.colorScheme'),
      ).toMatchInlineSnapshot(`""`)
      expect(await page.evaluate('Fixture.appearance.current()'))
        .toMatchInlineSnapshot(`
        {
          "theme": "base",
        }
      `)

      // Unknown themes fall back per field while the valid scheme still applies.
      await page.evaluate(
        `localStorage.setItem('zyzz', '{"theme":"ocean","colorScheme":"dark"}')`,
      )
      await page.reload()

      expect(await page.evaluate('Fixture.restored')).toMatchInlineSnapshot(`
        {
          "colorScheme": "dark",
          "theme": "base",
        }
      `)

      await page.evaluate("localStorage.setItem('zyzz', '{')")
      await page.reload()

      expect(await page.evaluate('Fixture.restored')).toMatchInlineSnapshot(`
        {
          "colorScheme": "light dark",
          "theme": "base",
        }
      `)
    } finally {
      await browser?.close()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
    }
  })
})
