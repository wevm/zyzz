/**
 * Exercises the public Vite plugin through builds, HTTP, and real file updates.
 * @module
 */
import * as Trace from '@jridgewell/trace-mapping'
import * as ChildProcess from 'node:child_process'
import * as Util from 'node:util'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import * as Vite from 'vite'
import { describe, expect, test } from 'vite-plus/test'
import { zyzz } from 'zyzz/vite'
import * as Library from '../../test/fixtures/Library.js'
import * as Fixture from '../../test/fixtures/Vite.js'

async function create(files: Readonly<Record<string, string>> = Fixture.files) {
  const root = await Fs.mkdtemp(Path.resolve('.fixture-vite-'))

  for (const [name, content] of Object.entries(files))
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
  for (const configuration of [false, true]) {
    function source(value: string) {
      if (!configuration) return value

      return value
        .replace(
          '{ css, theme, mint, props as libraryProps }',
          '{ zyzz, props as libraryProps }',
        )
        .replace('{ css, theme, mint, props }', '{ zyzz, props }')
        .replace('{ css, theme }', '{ zyzz }')
        .replace(/\btheme\./g, 'zyzz.themes.base.')
        .replace(/\bmint\./g, 'zyzz.themes.mint.')
        .replace(/\bcss\(/g, 'zyzz.css(')
        .replace('Theme.extend(theme,', 'Theme.extend(zyzz.themes.base,')
        .replaceAll('zyzz.zyzz.css', 'zyzz.css')
    }

    test(`packed ${configuration ? 'configurations' : 'themes'} retain types and compile through Vite package exports`, async () => {
      const directory = await Fs.mkdtemp(Path.resolve('.fixture-library-'))

      try {
        const root = await Library.create(directory, { configuration })

        await Fs.writeFile(
          Path.join(root, 'app.ts'),
          source(`import { css, theme, mint, props as libraryProps } from '@acme/theme';
import '@acme/theme/style.css';
export const props = css({color:theme.tokens.color.brand,padding:'md'})();
export const scope = mint.className;
export { libraryProps };
document.body.innerHTML = '<main class="' + scope + '"><div id="library" class="' + libraryProps.className + '"></div><div id="app" class="' + props.className + '"></div></main>';`),
        )
        await Fs.writeFile(
          Path.join(root, 'types.ts'),
          source(`import { css, theme } from '@acme/theme'; css({color:'brand',padding:'md'}); css({color:theme.tokens.color.brand});
// @ts-expect-error Unknown tokens remain invalid through packed declarations.
css({color:'missing'});
// @ts-expect-error Imported references preserve property domains.
css({padding:theme.tokens.color.brand});
${configuration ? "zyzz.css({'@layer components':{color:'brand'}});\n// @ts-expect-error Packed layer keys remain exact.\nzyzz.css({'@layer missing':{color:'brand'}});" : ''}`),
        )

        const checked = await Util.promisify(ChildProcess.execFile)(
          process.execPath,
          [
            Path.resolve('node_modules/typescript/bin/tsc'),
            '--customConditions',
            'src',
            '--module',
            'nodenext',
            '--target',
            'esnext',
            '--strict',
            '--skipLibCheck',
            '--noEmit',
            Path.join(root, 'types.ts'),
          ],
        )

        expect(checked.stdout).toMatchInlineSnapshot(`""`)

        // Remove negative type probes before the eager application source scan.
        await Fs.rm(Path.join(root, 'types.ts'))

        await Fs.writeFile(
          Path.join(root, 'index.html'),
          '<script type="module" src="/app.ts"></script>',
        )

        const config: Vite.InlineConfig = {
          build: { cssTarget: ['chrome123', 'firefox128', 'safari17.5'] },
          configFile: false,
          logLevel: 'silent',
          optimizeDeps: { exclude: ['@acme/theme'] },
          plugins: [zyzz()],
          root,
          server: { host: '127.0.0.1', port: 0 },
        }

        const build = await Vite.build({ ...config, build: { minify: false } })
        if (Array.isArray(build) || !('output' in build))
          throw new Error('Expected a Vite build')

        const scripts = build.output
          .filter((entry) => entry.type === 'chunk')
          .map((entry) => entry.code)
          .join('\n')

        expect(
          /Theme\.define|theme\.tokens|\.css\(\{|zyzz\.json|Unsupported Zyzz contract/.test(
            scripts,
          ),
        ).toMatchInlineSnapshot(`false`)

        const styles = build.output
          .filter(
            (entry) =>
              entry.type === 'asset' && entry.fileName.endsWith('.css'),
          )
          .map((entry) => (entry.type === 'asset' ? String(entry.source) : ''))
          .join('\n')

        expect(styles.includes('light-dark(')).toMatchInlineSnapshot(`true`)

        const server = await Vite.createServer(config)

        try {
          await server.listen()

          const transformed = await server.transformRequest('/app.ts')

          expect(
            transformed!.code.includes('theme.tokens'),
          ).toMatchInlineSnapshot(`false`)

          const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, '')
          const cssPath = transformed!.code.match(
            /import "([^"\n]*zyzz:(?!shared\.css)[^"\n]*\.css)"/,
          )![1]!
          const css = await (await fetch(origin + cssPath)).text()

          expect(css.includes('--z-t')).toMatchInlineSnapshot(`true`)
        } finally {
          await server.close()
        }
      } finally {
        await Fs.rm(directory, { recursive: true, force: true })
      }
    }, 30000)

    test(`packed ${configuration ? 'configuration' : 'theme'} library and app styles share scopes and schemes in Chromium`, async () => {
      const directory = await Fs.mkdtemp(
        Path.resolve('.fixture-library-browser-'),
      )

      try {
        const root = await Library.create(directory, { configuration })

        await Fs.writeFile(
          Path.join(root, 'index.html'),
          '<script type="module" src="/app.ts"></script>',
        )
        await Fs.writeFile(
          Path.join(root, 'app.ts'),
          source(`import { css, theme, mint, props } from '@acme/theme'; import { Theme } from 'zyzz'; import '@acme/theme/style.css';
const extended = Theme.extend(theme, {spacing:{md:'16px'}});
const app = css({color:'brand'})();
document.body.innerHTML = '<main class="' + mint.className + '"><div id="library" class="' + props.className + '"></div><div id="app" class="' + app.className + '"></div><section class="' + theme.className + '"><div id="nested" class="' + app.className + '"></div></section><section class="' + extended.className + '"><div id="extended" class="' + props.className + '"></div></section></main>';`),
        )

        const config: Vite.InlineConfig = {
          build: { cssTarget: ['chrome123', 'firefox128', 'safari17.5'] },
          configFile: false,
          logLevel: 'silent',
          optimizeDeps: { exclude: ['@acme/theme'] },
          plugins: [zyzz()],
          root,
          server: { host: '127.0.0.1', port: 0 },
        }

        await Vite.build(config)

        const server = await Vite.preview({
          ...config,
          preview: { host: '127.0.0.1', port: 0 },
        })

        try {
          const browser = await chromium.launch()

          try {
            const page = await browser.newPage()

            await page.goto(server.resolvedUrls!.local[0]!)
            await page.waitForSelector('#app', { state: 'attached' })

            for (const selector of ['#library', '#app']) {
              expect(
                await page
                  .locator(selector)
                  .evaluate((element) => getComputedStyle(element).color),
              ).toMatchInlineSnapshot(`"rgb(17, 119, 85)"`)
            }

            expect(
              await page
                .locator('#library')
                .evaluate((element) => getComputedStyle(element).padding),
            ).toMatchInlineSnapshot(`"8px"`)
            expect(
              await page
                .locator('#extended')
                .evaluate((element) => getComputedStyle(element).padding),
            ).toMatchInlineSnapshot(`"16px"`)

            expect(
              await page
                .locator('#nested')
                .evaluate((element) => getComputedStyle(element).color),
            ).toMatchInlineSnapshot(`"rgb(0, 102, 204)"`)

            const className = await page.locator('#app').getAttribute('class')

            await page.evaluate(() => {
              document.documentElement.style.colorScheme = 'dark'
            })

            expect(
              await page
                .locator('#app')
                .evaluate((element) => getComputedStyle(element).color),
            ).toMatchInlineSnapshot(`"rgb(170, 255, 170)"`)
            expect(
              await page
                .locator('#library')
                .evaluate((element) => getComputedStyle(element).color),
            ).toMatchInlineSnapshot(`"rgb(170, 255, 170)"`)
            expect(
              await page
                .locator('#nested')
                .evaluate((element) => getComputedStyle(element).color),
            ).toMatchInlineSnapshot(`"rgb(153, 204, 255)"`)
            expect(
              (await page.locator('#app').getAttribute('class')) === className,
            ).toMatchInlineSnapshot(`true`)
          } finally {
            await browser.close()
          }
        } finally {
          await new Promise<void>((resolve, reject) =>
            server.httpServer.close((error) =>
              error ? reject(error) : resolve(),
            ),
          )
        }
      } finally {
        await Fs.rm(directory, { recursive: true, force: true })
      }
    }, 30000)
  }

  test('production leaves lazy styles in Vite dynamic chunks', async () => {
    const { config, root } = await create(Fixture.lazyFiles)

    try {
      await Fs.appendFile(
        Path.join(root, 'lazy.ts'),
        `\nthrow new Error('lazy source was executed');`,
      )

      const result = await Vite.build({
        ...config,
        build: { manifest: true, minify: false, write: false },
      })
      if (Array.isArray(result) || !('output' in result))
        throw new Error('Expected one Vite build output')

      const manifest = result.output.find(
        (file) => file.fileName === '.vite/manifest.json',
      )
      if (!manifest || manifest.type !== 'asset')
        throw new Error('Missing Vite manifest')

      const entries = JSON.parse(String(manifest.source)) as Record<
        string,
        { css?: string[]; dynamicImports?: string[]; isDynamicEntry?: boolean }
      >

      expect(entries['index.html']?.dynamicImports).toMatchInlineSnapshot(`
        [
          "lazy.ts",
        ]
      `)

      const entryCss = result.output
        .flatMap((file) =>
          file.type === 'asset' &&
          entries['index.html']?.css?.includes(file.fileName)
            ? [String(file.source)]
            : [],
        )
        .join('')

      expect(entryCss.trim()).toMatchInlineSnapshot('""')
      expect(entries['lazy.ts']?.isDynamicEntry).toMatchInlineSnapshot('true')
      expect(entries['lazy.ts']?.css?.length).toMatchInlineSnapshot('1')

      const sheet = result.output.find(
        (file) => file.fileName === entries['lazy.ts']?.css?.[0],
      )
      if (!sheet || sheet.type !== 'asset')
        throw new Error('Missing lazy stylesheet')

      expect(String(sheet.source).includes('#175')).toMatchInlineSnapshot(
        'true',
      )
      expect(
        String(sheet.source).includes('padding:8px'),
      ).toMatchInlineSnapshot('true')

      const javascript = result.output
        .filter((file) => file.type === 'chunk')
        .map((file) => file.code)
        .join('\n')

      expect(javascript.includes('Theme.define')).toMatchInlineSnapshot('false')
      expect(
        javascript.includes('lazy source was executed'),
      ).toMatchInlineSnapshot('true')
    } finally {
      await Fs.rm(root, { recursive: true, force: true })
    }
  })

  test('development loads dynamic modules through Vite and preserves SSR imports', async () => {
    const { config, root } = await create(Fixture.lazyFiles)
    const server = await Vite.createServer(config)

    try {
      await server.listen()

      const address = server.httpServer!.address()
      if (!address || typeof address === 'string')
        throw new Error('Missing server port')

      const origin = `http://127.0.0.1:${address.port}`
      const response = await fetch(`${origin}/main.ts`)

      expect(response.status).toMatchInlineSnapshot('200')
      expect(
        (await response.text()).includes('import("/lazy.ts")'),
      ).toMatchInlineSnapshot('true')

      const lazy = await fetch(`${origin}/lazy.ts`)

      expect(lazy.status).toMatchInlineSnapshot('200')

      const cssPath = (await lazy.text()).match(
        /import\s*["']([^"']*zyzz:(?!shared\.css)[^"']+\.css)["']/,
      )?.[1]
      if (!cssPath) throw new Error('Missing lazy CSS import')

      expect(
        (await (await fetch(origin + cssPath)).text()).includes('#175'),
      ).toMatchInlineSnapshot('true')

      await Fs.writeFile(
        Path.join(root, 'server.ts'),
        `export const load = () => import('./card');`,
      )

      const module = (await server.ssrLoadModule('/server.ts')) as {
        load: () => Promise<{ props: { className: string } }>
      }

      expect((await module.load()).props.className).toMatchInlineSnapshot(
        `"z-text-87viPH-0 z-p-87viPH-1"`,
      )
    } finally {
      await server.close()
      await Fs.rm(root, { recursive: true, force: true })
    }
  })

  test('lazy CSS loads on demand and updates without reload in Chromium', async () => {
    const { config, root } = await create(Fixture.lazyFiles)
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

      expect(
        await page.locator('#card').getAttribute('class'),
      ).toMatchInlineSnapshot('null')

      await page.click('#load')
      await page.waitForFunction(
        () =>
          getComputedStyle(document.querySelector('#card')!).color ===
          'rgb(17, 119, 85)',
      )

      expect(
        await page
          .locator('#card')
          .evaluate((element) => getComputedStyle(element).padding),
      ).toMatchInlineSnapshot('"8px"')

      await page
        .locator('#card')
        .evaluate((element) => element.setAttribute('data-preserved', 'yes'))
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
      ).toMatchInlineSnapshot('"yes"')
    } finally {
      await browser?.close()
      await server.close()
      await Fs.rm(root, { recursive: true, force: true })
    }
  }, 30000)

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
        .z-text-rxmkdJ{color:var(--z-t8emm311c7xzi9-theme-color_2e_brand,#06c);}
        .z-p-8px-rxmkdJ{padding:8px;}.z_theme-8emm311c7xzi9-theme{--z-t8emm311c7xzi9-theme-color_2e_brand:#06c;}
        .z_theme-wo97ow1iqyoeo-mint{--z-t8emm311c7xzi9-theme-color_2e_brand:#175;}
        .z-text-rxmkdJ{color:var(--z-t8emm311c7xzi9-theme-color_2e_brand,#06c);}
        .z-p-8px-rxmkdJ{padding:8px;}"
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
        /import\s*["']([^"']*zyzz:(?!shared\.css)[^"']+\.css)["']/,
      )?.[1]
      if (!cssPath) throw new Error(`Missing CSS import in ${code}`)

      const stylesheet = async () => (await fetch(origin + cssPath)).text()

      await stylesheet()

      const cssModule = [
        ...server.environments.client!.moduleGraph.idToModuleMap.values(),
      ].find(
        (module) =>
          module.id?.startsWith('\0zyzz:') && module.id !== '\0zyzz:shared.css',
      )
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
        `"z-text-87viPH-0 z-p-87viPH-1"`,
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
