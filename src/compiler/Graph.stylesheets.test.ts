/** Verifies relocated packed stylesheets, animation references, assets, maps, and rebuilds. @module */
import * as Http from 'node:http'
import { chromium } from 'playwright'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Trace from '@jridgewell/trace-mapping'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Source } from 'zyzz/compiler'
import { Host } from 'zyzz/node'
describe('compile', () => {
  test('packs source content once and links TypeScript animation aliases', () => {
    const source = `import {global,keyframes} from 'zyzz/web';global({body:{color:'red'}});const fade=keyframes({from:{opacity:0},to:{opacity:1}});export const enter=fade satisfies string;`
    const library = Graph.compile({ modules: { 'index.ts': source } })
    const sections = JSON.parse(library.contracts['index.ts']!).stylesheets
    expect(
      sections.filter(
        (section: { content?: string }) => section.content !== undefined,
      ).length,
    ).toMatchInlineSnapshot('1')
    const app = Graph.compile({
      contracts: { 'lib.js': library.contracts['index.ts']! },
      imports: { 'app.ts': { lib: 'lib.js', zyzz: null } },
      modules: {
        'app.ts': `import {enter} from 'lib';import {css} from 'zyzz';export const styles={card:css({animationName:enter})};`,
      },
    })
    expect(app.modules['app.ts']!.css).toMatchInlineSnapshot(
      `".z-1e8a67z1uaws1j-base0{animation-name:z-k1wfnqsmu0q6os-66-61-64-65;}"`,
    )
    expect(new Trace.TraceMap(app.sharedCssMap!).sourcesContent)
      .toMatchInlineSnapshot(`
      [
        "import {global,keyframes} from 'zyzz/web';global({body:{color:'red'}});const fade=keyframes({from:{opacity:0},to:{opacity:1}});export const enter=fade satisfies string;",
      ]
    `)
  })
  const source = `import {fontFace,global,keyframes,layers} from 'zyzz/web';layers(['reset','components']);fontFace({fontFamily:'App',src:'url(./assets/app.woff2)'});global({body:{backgroundImage:'url(./assets/pixel.png)'}});export const fade=keyframes({from:{opacity:0},to:{opacity:1}});`
  test('links relocated animation aliases and preserves packed side effects once', () => {
    const library = Graph.compile({
      modules: {
        'pkg/effects.ts': source + 'export const enter=fade;',
        'pkg/index.ts': `export {enter as fade} from './effects.js';`,
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
      map.sourcesContent?.some(
        (content) => content === source + 'export const enter=fade;',
      ),
    ).toMatchInlineSnapshot('true')
  })
  test('preserves path-like URL suffixes and rejects nested output collisions', async () => {
    const graph = Graph.compile({
      modules: {
        'pkg/a.ts': `import {global} from 'zyzz/web';global({body:{backgroundImage:'url(./asset.svg?fallback=/../other.svg)'}});`,
      },
    })
    expect(Object.values(graph.sharedAssets ?? {})).toMatchInlineSnapshot(`
      [
        "pkg/asset.svg?fallback=/../other.svg",
      ]
    `)
    const root = await Fs.mkdtemp(Path.resolve('.fixture-asset-collision-'))
    try {
      await Fs.mkdir(Path.join(root, 'effects.ts.css'))
      await Fs.writeFile(Path.join(root, 'effects.ts.css/pixel.png'), 'pixel')
      await Fs.writeFile(
        Path.join(root, 'effects.ts'),
        `import {global} from 'zyzz/web';global({body:{backgroundImage:'url(./effects.ts.css/pixel.png)'}})`,
      )
      const host = await Host.create({
        root,
        outDir: Path.join(root, 'out'),
        packageId: 'pkg',
      })
      await expect(host.build()).rejects.toThrow(
        'Asset path conflicts with generated output.',
      )
      await Fs.mkdir(Path.join(root, 'assets'))
      await Fs.writeFile(Path.join(root, 'assets/icon:dark.svg'), 'icon')
      await Fs.writeFile(
        Path.join(root, 'effects.ts'),
        `import {global} from 'zyzz/web';global({body:{backgroundImage:'url(./assets/icon:dark.svg)'}})`,
      )
      await expect(host.build()).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: Asset path escapes the package root.]`,
      )
      await host.close()
    } finally {
      await Fs.rm(root, { recursive: true, force: true })
    }
  })
  test('maps separate contribution calls to their own authored positions', () => {
    const source = `import {global} from 'zyzz/web';
global({body:{color:'red'}});

global({html:{color:'blue'}});`
    const library = Graph.compile({ modules: { 'effects.ts': source } })
    const output = Graph.compile({
      modules: { 'app.ts': `import 'lib'` },
      imports: { 'app.ts': { lib: 'lib/index.js' } },
      contracts: { 'lib/index.js': library.contracts['effects.ts']! },
    })
    const map = new Trace.TraceMap(output.sharedCssMap!)
    const line =
      output.sharedCss!.split('\n').findIndex((line) => line.includes('html')) +
      1
    expect(
      Trace.originalPositionFor(map, { line, column: 0 }).line,
    ).toMatchInlineSnapshot('4')
  })
  test('does not capture nested shadows of imported animations', () => {
    const output = Graph.compile({
      modules: {
        'effects.ts': source,
        'app.ts': `import {fade} from './effects.js';function other(fade:unknown){let alias=fade;return alias}export {fade}`,
      },
    })
    expect(output.sharedCss?.includes('@keyframes')).toMatchInlineSnapshot(
      'true',
    )
  })
  test('attributes malformed packed CSS and rejects conflicting layer metadata', () => {
    const library = Graph.compile({ modules: { 'effects.ts': source } })
    const contract = JSON.parse(library.contracts['effects.ts']!)
    contract.stylesheets[1].css = '@import ;'
    expect(() =>
      Graph.compile({
        modules: { 'app.ts': `import 'lib'` },
        imports: { 'app.ts': { lib: 'lib/index.js' } },
        contracts: { 'lib/index.js': JSON.stringify(contract) },
      }),
    ).toThrow(Source.ExtractError)
    const first = JSON.parse(library.contracts['effects.ts']!)
    const second = JSON.parse(library.contracts['effects.ts']!)
    second.stylesheets[0].layers = [['different']]
    expect(() =>
      Graph.compile({
        modules: { 'app.ts': `import 'a';import 'b'` },
        imports: { 'app.ts': { a: 'lib/a.js', b: 'lib/b.js' } },
        contracts: {
          'lib/a.js': JSON.stringify(first),
          'lib/b.js': JSON.stringify(second),
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      '[Source.ExtractError: lib/b.js:0: Conflicting packed stylesheet contributions.]',
    )
  })
  test('normalizes encoded asset traversal and rejects generated or control-file collisions', async () => {
    const root = await Fs.mkdtemp(Path.resolve('.fixture-assets-paths-'))
    try {
      await Fs.mkdir(Path.join(root, 'sub'))
      await Fs.writeFile(
        Path.join(root, 'asset.png'),
        new Uint8Array([1, 2, 3]),
      )
      await Fs.writeFile(
        Path.join(root, 'sub/effects.ts'),
        `import {global} from 'zyzz/web';global({body:{backgroundImage:'url(%2e%2e/asset.png)'}})`,
      )
      await using host = await Host.create({
        root,
        outDir: Path.join(root, 'out'),
        packageId: 'pkg',
      })
      await host.build()
      expect((await host.build()).changed).toMatchInlineSnapshot('[]')
      for (const name of [
        'zyzz.shared.css',
        '.ZYZZ.JSON',
        'sub/effects.ts.css',
      ]) {
        await Fs.writeFile(Path.join(root, name), 'asset')
        await Fs.writeFile(
          Path.join(root, 'sub/effects.ts'),
          `import {global} from 'zyzz/web';global({body:{backgroundImage:'url(../${name})'}})`,
        )
        await expect(host.build()).rejects.toThrow(/conflicts/)
      }
    } finally {
      await Fs.rm(root, { recursive: true, force: true })
    }
  })
  test('retains animations exported through a specifier list', () => {
    const output = Graph.compile({
      modules: {
        'effects.ts': `import {keyframes} from 'zyzz/web';const fade=keyframes({from:{opacity:0},to:{opacity:1}});export {fade}`,
      },
    })
    expect(output.sharedCss?.includes('@keyframes')).toMatchInlineSnapshot(
      'true',
    )
  })
  test('does not retain animation names exported only as types', () => {
    const output = Graph.compile({
      modules: {
        'effects.ts': `import {keyframes} from 'zyzz/web';const fade=keyframes({from:{opacity:0},to:{opacity:1}});type fade=typeof fade;export type {fade}`,
      },
    })
    expect(output.sharedCss).toMatchInlineSnapshot('undefined')
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
      expect(loaded).toMatchInlineSnapshot(`
          [
            "asset",
          ]
        `)
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
