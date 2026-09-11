/** Verifies relocated packed stylesheets, animation references, assets, maps, and rebuilds. @module */
import * as Http from 'node:http'
import { chromium } from 'playwright'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Trace from '@jridgewell/trace-mapping'
import { describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'
import { Host } from 'zyzz/node'
const source = `import {fontFace,global,keyframes,layers} from 'zyzz/web';layers(['reset','components']);fontFace({fontFamily:'App',src:'url(./assets/app.woff2)'});global({body:{backgroundImage:'url(./assets/pixel.png)'}});export const fade=keyframes({from:{opacity:0},to:{opacity:1}});`
describe('compile', () => {
  test('links relocated animation aliases and preserves packed side effects once', () => {
    const library = Graph.compile({
      modules: {
        'pkg/effects.ts': source,
        'pkg/index.ts': `export {fade} from './effects.js';`,
      },
    })
    const output = Graph.compile({
      contracts: {
        'app/node_modules/lib/index.js': library.contracts['pkg/index.ts']!,
      },
      imports: {
        'app/main.ts': { lib: 'app/node_modules/lib/index.js', zyzz: null },
      },
      modules: {
        'app/main.ts': `import {fade as enter} from 'lib';import {css} from 'zyzz';const alias=enter;export const styles={card:css({animationName:alias})};`,
      },
    })
    expect(
      output.modules['app/main.ts']!.css.includes('animation-name:z-k'),
    ).toMatchInlineSnapshot('true')
    expect(
      output.sharedCss?.match(/@keyframes/g)?.length,
    ).toMatchInlineSnapshot('1')
    expect(output.sharedAssets).toMatchInlineSnapshot(`
      {
        "zyzz-asset:app%2Fnode_modules%2Flib%2Fassets%2Fapp.woff2": "app/node_modules/lib/assets/app.woff2",
        "zyzz-asset:app%2Fnode_modules%2Flib%2Fassets%2Fpixel.png": "app/node_modules/lib/assets/pixel.png",
      }
    `)
    expect(
      output.sharedCss?.includes('@layer reset,components;'),
    ).toMatchInlineSnapshot('true')
    const map = new Trace.TraceMap(output.sharedCssMap!)
    expect(
      Trace.originalPositionFor(map, { line: 2, column: 0 }).source,
    ).toMatchInlineSnapshot('"app/node_modules/lib/effects.ts"')
    expect(
      map.sourcesContent?.some((content) => content === source),
    ).toMatchInlineSnapshot('true')
  })
  test('serves relocated assets and layers with the optional reset in Chromium', async () => {
    const root = await Fs.mkdtemp(Path.resolve('.fixture-assets-browser-'))
    const server = Http.createServer(async (request, response) => {
      try {
        if (request.url === '/') {
          response.setHeader('Content-Type', 'text/html')
          response.end(
            '<link rel="stylesheet" href="/reset.css"><link rel="stylesheet" href="/zyzz.shared.css"><body>Styled page</body>',
          )
          return
        }
        const file = Path.join(root, 'out', request.url!.slice(1))
        response.setHeader(
          'Content-Type',
          file.endsWith('.svg') ? 'image/svg+xml' : 'text/css',
        )
        response.end(await Fs.readFile(file))
      } catch {
        response.statusCode = 404
        response.end()
      }
    })
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
    try {
      await Fs.mkdir(Path.join(root, 'assets'))
      await Fs.writeFile(
        Path.join(root, 'assets/pixel.svg'),
        '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="red"/></svg>',
      )
      await Fs.writeFile(
        Path.join(root, 'effects.ts'),
        `import {global} from 'zyzz/web';global({body:{margin:'13px',backgroundImage:'url(./assets/pixel.svg)'}});`,
      )
      await using host = await Host.create({
        root,
        outDir: Path.join(root, 'out'),
        packageId: 'pkg',
      })
      await host.build()
      await Fs.copyFile(
        Path.resolve('src/reset.css'),
        Path.join(root, 'out/reset.css'),
      )
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
      )
      browser = await chromium.launch()
      const page = await browser.newPage()
      const loaded: string[] = []
      page.on('response', (response) => {
        if (response.url().endsWith('pixel.svg') && response.status() === 200)
          loaded.push('asset')
      })
      await page.goto(
        `http://127.0.0.1:${(server.address() as { port: number }).port}/`,
      )
      expect(
        await page
          .locator('body')
          .evaluate((el) => getComputedStyle(el).marginTop),
      ).toMatchInlineSnapshot('"13px"')
      expect(loaded).toMatchInlineSnapshot('["asset"]')
      await page.evaluate(
        `document.head.append(document.querySelector('link[href="/reset.css"]'))`,
      )
      expect(
        await page
          .locator('body')
          .evaluate((el) => getComputedStyle(el).marginTop),
      ).toMatchInlineSnapshot('"13px"')
    } finally {
      await browser?.close()
      if (server.listening)
        await new Promise<void>((resolve) => server.close(() => resolve()))
      await Fs.rm(root, { recursive: true, force: true })
    }
  })
  test('publishes binary relative assets with source maps and updates them atomically', async () => {
    const root = await Fs.mkdtemp(Path.resolve('.fixture-assets-'))
    try {
      await Fs.mkdir(Path.join(root, 'assets'))
      await Fs.writeFile(Path.join(root, 'effects.ts'), source)
      await Fs.writeFile(
        Path.join(root, 'assets/app.woff2'),
        new Uint8Array([0, 255, 1, 128]),
      )
      await Fs.writeFile(
        Path.join(root, 'assets/pixel.png'),
        new Uint8Array([137, 80, 78, 71, 0, 255]),
      )
      await using host = await Host.create({
        root,
        outDir: Path.join(root, 'out'),
        packageId: 'pkg',
      })
      await host.build()
      expect([...(await Fs.readFile(Path.join(root, 'out/assets/app.woff2')))])
        .toMatchInlineSnapshot(`
        [
          0,
          255,
          1,
          128,
        ]
      `)
      expect(
        (
          await Fs.readFile(Path.join(root, 'out/zyzz.shared.css'), 'utf8')
        ).includes('zyzz-asset:'),
      ).toMatchInlineSnapshot('false')
      expect(
        JSON.parse(
          await Fs.readFile(Path.join(root, 'out/zyzz.shared.css.map'), 'utf8'),
        ).sourcesContent.includes(source),
      ).toMatchInlineSnapshot('true')
      expect((await host.build()).changed).toMatchInlineSnapshot('[]')
      await Fs.writeFile(
        Path.join(root, 'assets/app.woff2'),
        new Uint8Array([5, 255, 2]),
      )
      expect((await host.build()).changed).toMatchInlineSnapshot(`
        [
          "assets/app.woff2",
        ]
      `)
    } finally {
      await Fs.rm(root, { recursive: true, force: true })
    }
  })
})
