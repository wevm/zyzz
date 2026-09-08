/**
 * Exercises the public Vite plugin through builds, HTTP, and real file updates.
 * @module
 */
import * as Trace from '@jridgewell/trace-mapping'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import * as Vite from 'vite'
import { describe, expect, test } from 'vite-plus/test'
import { zyzz } from 'zyzz/vite'
import * as Fixture from '../../test/fixtures/Vite.js'

async function create() {
  const root = await Fs.mkdtemp(Path.resolve('.fixture-vite-'))
  for (const [name, content] of Object.entries(Fixture.files))
    await Fs.writeFile(Path.join(root, name), content)
  const config: Vite.InlineConfig = {
    configFile: false,
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true },
    plugins: [zyzz()],
    resolve: {
      alias: {
        '@theme': Path.join(root, 'theme.ts'),
        'zyzz/runtime': Path.resolve('src/runtime/index.ts'),
      },
    },
    root,
    server: { host: '127.0.0.1', port: 0 },
  }
  return { config, root }
}

function message(socket: WebSocket, action: () => Promise<unknown>) {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Vite HMR timed out'))
    }, 10000)
    function cleanup() {
      clearTimeout(timer)
      socket.removeEventListener('message', onMessage)
    }
    function onMessage(event: MessageEvent) {
      const text = String(event.data)
      if (
        !text.includes('"type":"update"') &&
        !text.includes('"type":"full-reload"')
      )
        return
      cleanup()
      resolve(text)
    }
    socket.addEventListener('message', onMessage)
    void action().catch((error: unknown) => {
      cleanup()
      reject(error)
    })
  })
}

describe('zyzz', () => {
  test('production uses Vite resolution and emits linked CSS without executing sources', async () => {
    const { config, root } = await create()
    try {
      await Fs.appendFile(
        Path.join(root, 'theme.ts'),
        `\nthrow new Error('authoring was executed');`,
      )
      const result = await Vite.build({
        ...config,
        build: { minify: false, write: false },
      })
      if (Array.isArray(result) || !('output' in result))
        throw new Error('Expected one Vite build output')
      const sheet = result.output.find(
        (file) => file.type === 'asset' && file.fileName.endsWith('.css'),
      )
      if (!sheet || sheet.type !== 'asset')
        throw new Error('No stylesheet emitted')
      expect(String(sheet.source)).toMatchInlineSnapshot(`
        ".z_theme-8emm311c7xzi9-theme{--z-t8emm311c7xzi9-theme-color_2e_brand:#06c;}
        .z-ujlnau19561g8-base0{color:var(--z-t8emm311c7xzi9-theme-color_2e_brand,#06c);padding:8px;}.z_theme-8emm311c7xzi9-theme{--z-t8emm311c7xzi9-theme-color_2e_brand:#06c;}
        .z_theme-wo97ow1iqyoeo-mint{--z-t8emm311c7xzi9-theme-color_2e_brand:#175;}
        .z-ujlnau19561g8-base0{color:var(--z-t8emm311c7xzi9-theme-color_2e_brand,#06c);padding:8px;}"
      `)
      const javascript = result.output
        .filter((file) => file.type === 'chunk')
        .map((file) => file.code)
        .join('\n')
      expect(javascript.includes('Theme.define')).toMatchInlineSnapshot(`false`)
      expect(
        javascript.includes('authoring was executed'),
      ).toMatchInlineSnapshot(`false`)
    } finally {
      await Fs.rm(root, { recursive: true, force: true })
    }
  })

  test('development invalidates virtual CSS after theme edits and recovers from deletion', async () => {
    const { config, root } = await create()
    const server = await Vite.createServer(config)
    let socket: WebSocket | undefined
    try {
      await server.listen()
      const address = server.httpServer!.address()
      if (!address || typeof address === 'string')
        throw new Error('Missing server port')
      const origin = `http://127.0.0.1:${address.port}`
      const response = await fetch(`${origin}/main.ts`)
      const code = await response.text()
      expect(response.status).toMatchInlineSnapshot(`200`)
      const cssPath = code.match(
        /import\s*["']([^"']*zyzz:[^"']+\.css)["']/,
      )?.[1]
      if (!cssPath) throw new Error(`Missing CSS import in ${code}`)
      const stylesheet = async () => (await fetch(origin + cssPath)).text()
      await stylesheet()
      const cssModule = [
        ...server.environments.client!.moduleGraph.idToModuleMap.values(),
      ].find((module) => module.id?.startsWith('\0zyzz:'))
      if (!cssModule) throw new Error('Missing virtual CSS module')
      const loaded = await server.environments.client!.pluginContainer.load(
        cssModule.id!,
      )
      if (!loaded || typeof loaded === 'string' || !loaded.map)
        throw new Error('Missing CSS source map')
      const trace = new Trace.TraceMap(
        typeof loaded.map === 'string'
          ? loaded.map
          : JSON.stringify(loaded.map),
      )
      const location = Trace.originalPositionFor(trace, { column: 0, line: 1 })
      expect(Path.relative(root, location.source!)).toMatchInlineSnapshot(
        `"theme.ts"`,
      )
      expect(location.line).toMatchInlineSnapshot(`1`)
      const rendered = (await server.ssrLoadModule('/card.ts')) as {
        props: { className: string }
      }
      expect(rendered.props.className).toMatchInlineSnapshot(
        `"z-ujlnau19561g8-base0"`,
      )

      expect((await stylesheet()).includes('#175')).toMatchInlineSnapshot(
        `true`,
      )
      socket = new WebSocket(
        `ws://127.0.0.1:${address.port}/?token=${server.config.webSocketToken}`,
        'vite-hmr',
      )
      await new Promise<void>((resolve, reject) => {
        socket!.onopen = () => resolve()
        socket!.onerror = () => reject(new Error('WebSocket failed'))
      })
      const path = Path.join(root, 'alternate.ts')
      const update = await message(socket, () =>
        Fs.writeFile(
          path,
          Fixture.files['alternate.ts'].replace('#175', '#f00'),
        ),
      )
      expect(update.includes('zyzz:')).toMatchInlineSnapshot(`true`)
      expect((await stylesheet()).includes('#f00')).toMatchInlineSnapshot(
        `true`,
      )
      await message(socket, () => Fs.rm(path))
      expect((await fetch(origin + cssPath)).status).toMatchInlineSnapshot(
        `500`,
      )
      await message(socket, () =>
        Fs.writeFile(path, Fixture.files['alternate.ts']),
      )
      expect((await stylesheet()).includes('#175')).toMatchInlineSnapshot(
        `true`,
      )
      await message(socket, () =>
        Fs.writeFile(
          Path.join(root, 'main.ts'),
          Fixture.files['main.ts'].replace('./alternate', './new-theme'),
        ),
      )
      expect((await fetch(origin + cssPath)).status).toMatchInlineSnapshot(
        `500`,
      )
      await message(socket, () =>
        Fs.writeFile(
          Path.join(root, 'new-theme.ts'),
          Fixture.files['alternate.ts'].replace('#175', '#00f'),
        ),
      )
      expect((await stylesheet()).includes('#00f')).toMatchInlineSnapshot(
        `true`,
      )
    } finally {
      socket?.close()
      await server.close()
      await Fs.rm(root, { recursive: true, force: true })
    }
  }, 30000)

  test('Vite HMR updates rendered theme scopes in Chromium', async () => {
    const { config, root } = await create()
    const server = await Vite.createServer(config)
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
    try {
      browser = await chromium.launch()
      await server.listen()
      const address = server.httpServer!.address()
      if (!address || typeof address === 'string')
        throw new Error('Missing server port')
      const page = await browser.newPage()
      await page.goto(`http://127.0.0.1:${address.port}`)
      await page.waitForFunction(
        () =>
          getComputedStyle(document.querySelector('#card')!).color ===
          'rgb(17, 119, 85)',
      )
      expect(
        await page
          .locator('#card')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(17, 119, 85)"`)
      await page.evaluate(() => {
        document.querySelector('#card')!.setAttribute('data-preserved', 'yes')
      })
      await Fs.writeFile(
        Path.join(root, 'alternate.ts'),
        Fixture.files['alternate.ts'].replace('#175', '#f00'),
      )
      await page.waitForFunction(
        () =>
          getComputedStyle(document.querySelector('#card')!).color ===
          'rgb(255, 0, 0)',
      )
      expect(
        await page.locator('#card').getAttribute('data-preserved'),
      ).toMatchInlineSnapshot(`"yes"`)
      expect(
        await page
          .locator('#card')
          .evaluate((element) => getComputedStyle(element).padding),
      ).toMatchInlineSnapshot(`"8px"`)
    } finally {
      await browser?.close()
      await server.close()
      await Fs.rm(root, { recursive: true, force: true })
    }
  }, 30000)
})
