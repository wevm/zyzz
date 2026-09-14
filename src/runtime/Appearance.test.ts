/** Verifies compiled root controls read, apply, and persist selections in Chromium. @module */
import * as Esbuild from 'esbuild'
import * as Http from 'node:http'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'

describe('root', () => {
  test('applies fields over the current root selection and persists them for the script', async () => {
    const graph = Graph.compile({
      modules: {
        'config.ts': `import {Config} from 'zyzz';export const {appearance,script,themes}=Config.create({defaultTheme:'base',storageKey:'fixture',themes:{base:{color:{ink:'#123456'}},mint:{color:{ink:'#008844'}}}});export const mint=themes.mint.className;`,
      },
    })
    const code = graph.modules['config.ts']!.code

    expect(
      code.includes('appearance:__zyzzAppearance.root('),
    ).toMatchInlineSnapshot('true')
    expect(
      code.includes('"defaultTheme":"base","storageKey":"fixture"'),
    ).toMatchInlineSnapshot('true')

    const bundle = await Esbuild.build({
      stdin: { contents: code, loader: 'ts', resolveDir: process.cwd() },
      alias: { 'zyzz/runtime': Path.resolve('src/runtime/index.ts') },
      bundle: true,
      format: 'iife',
      globalName: 'Fixture',
      write: false,
    })
    const markup = `<!doctype html><html class="external"><head><script>${bundle.outputFiles[0]!.text}</script><script>document.documentElement.dataset.script=Fixture.script();</script></head><body></body></html>`
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

      // Without root classes the default theme is reported and the scheme inherits.
      expect(await page.evaluate('Fixture.appearance.get()'))
        .toMatchInlineSnapshot(`
        {
          "theme": "base",
        }
      `)

      await page.evaluate("Fixture.appearance.set({ colorScheme: 'dark' })")

      expect(
        await page.evaluate('document.documentElement.className'),
      ).toMatchInlineSnapshot(
        `"external z_theme-1qbgu41h24h5a-css-base z_scheme-dark"`,
      )
      expect(
        await page.evaluate('document.documentElement.style.colorScheme'),
      ).toMatchInlineSnapshot(`"dark"`)
      expect(
        await page.evaluate("localStorage.getItem('fixture')"),
      ).toMatchInlineSnapshot(`"{"theme":"base","colorScheme":"dark"}"`)

      await page.evaluate("Fixture.appearance.set({ theme: 'mint' })")

      expect(await page.evaluate('Fixture.appearance.get()'))
        .toMatchInlineSnapshot(`
        {
          "colorScheme": "dark",
          "theme": "mint",
        }
      `)
      expect(
        await page.evaluate(
          'document.documentElement.className === `external ${Fixture.mint} z_scheme-dark`',
        ),
      ).toMatchInlineSnapshot('true')

      // The generated script reads the same configured key.
      expect(
        await page.evaluate(
          'document.documentElement.dataset.script.includes(\'localStorage.getItem("fixture")\')',
        ),
      ).toMatchInlineSnapshot('true')

      await page.evaluate('Fixture.appearance.set({ colorScheme: undefined })')

      expect(await page.evaluate('Fixture.appearance.get()'))
        .toMatchInlineSnapshot(`
        {
          "theme": "mint",
        }
      `)
      expect(
        await page.evaluate('document.documentElement.style.colorScheme'),
      ).toMatchInlineSnapshot(`""`)

      expect(
        await page.evaluate(
          "(() => { try { Fixture.appearance.set({ theme: 'ocean' }); return 'applied' } catch (error) { return String(error) } })()",
        ),
      ).toMatchInlineSnapshot(`"TypeError: Invalid theme selection."`)
    } finally {
      await browser?.close()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
    }
  })
})
