/**
 * Exercises the public Vite plugin through builds, HTTP, and real file updates.
 * @module
 */
import * as Trace from '@jridgewell/trace-mapping'
import * as Esbuild from 'esbuild'
import * as ChildProcess from 'node:child_process'
import * as Util from 'node:util'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Os from 'node:os'
import * as Universal from '../../test/fixtures/UniversalLibrary.js'
import { chromium } from 'playwright'
import * as Vite from 'vite'
import { describe, expect, test, vi } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'
import { zyzz } from 'zyzz/vite'
import * as Library from '../../test/fixtures/Library.js'
import * as Fixture from '../../test/fixtures/Vite.js'
import * as Watch from '../../test/fixtures/Watch.js'

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

function message(
  socket: WebSocket,
  action: () => Promise<unknown>,
  accept?: (text: string) => boolean,
) {
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

      if (accept && !accept(text)) return

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
  test('builds a source-free namespace package for web and native consumers', async () => {
    const root = await Fs.mkdtemp(
      Path.join(Os.tmpdir(), 'zyzz-routing-consumer-'),
    )
    try {
      await Universal.create(root)
      await Fs.writeFile(
        Path.join(root, 'app.ts'),
        `import * as library from '@acme/universal';export const props=library.button({size:'large',active:true});`,
      )
      await Fs.writeFile(
        Path.join(root, 'web.ts'),
        `import '@acme/universal/style.css';export {props} from './app.js';`,
      )
      for (const target of ['native', 'web'] as const) {
        await Vite.build({
          root,
          configFile: false,
          logLevel: 'silent',
          plugins: [
            zyzz(
              target === 'native'
                ? { native: { colorScheme: 'dark', platform: 'android' } }
                : {},
            ),
          ],
          build: {
            outDir: `dist/${target}`,
            lib: {
              entry: Path.join(root, target === 'native' ? 'app.ts' : 'web.ts'),
              formats: [target === 'native' ? 'es' : 'iife'],
              name: 'Consumer',
              cssFileName: 'styles',
              fileName: () => (target === 'native' ? 'native.mjs' : 'web.js'),
            },
          },
        })
      }
      const exec = Util.promisify(ChildProcess.execFile)
      const native = await exec(process.execPath, [
        '--input-type=module',
        '-e',
        `import {props} from ${JSON.stringify(Path.join(root, 'dist/native/native.mjs'))};console.log(JSON.stringify(props));`,
      ])
      expect(JSON.parse(native.stdout)).toMatchInlineSnapshot(`
        {
          "style": {
            "color": "#abcdef",
            "fontSize": 20,
            "opacity": 0.8,
          },
        }
      `)
      expect(await Fs.readdir(Path.join(root, 'dist/native')))
        .toMatchInlineSnapshot(`
        [
          "native.mjs",
        ]
      `)
      const files = await Fs.readdir(Path.join(root, 'dist/web'))
      const css = await Fs.readFile(
        Path.join(
          root,
          'dist/web',
          files.find((file) => file.endsWith('.css'))!,
        ),
        'utf8',
      )
      const js = await Fs.readFile(Path.join(root, 'dist/web/web.js'), 'utf8')
      const browser = await chromium.launch({ headless: true })
      try {
        const page = await browser.newPage({ colorScheme: 'dark' })
        await page.setContent(
          `<style>:root{color-scheme:dark}${css}</style><div id="actual"></div><div id="control" style="color:#abcdef;font-size:20px;opacity:0.8"></div>`,
        )
        await page.addScriptTag({
          content:
            js +
            `;const element=document.querySelector('#actual');for(const [key,value] of Object.entries(Consumer.props)){if(key==='style')Object.assign(element.style,value);else element.setAttribute(key==='className'?'class':key,String(value))}`,
        })
        const actual = await page.locator('#actual').evaluate((element) => {
          const style = getComputedStyle(element)
          return {
            color: style.color,
            fontSize: style.fontSize,
            opacity: style.opacity,
          }
        })
        expect(actual).toMatchInlineSnapshot(`
          {
            "color": "rgb(171, 205, 239)",
            "fontSize": "20px",
            "opacity": "0.8",
          }
        `)
        const control = await page.locator('#control').evaluate((element) => {
          const style = getComputedStyle(element)
          return {
            color: style.color,
            fontSize: style.fontSize,
            opacity: style.opacity,
          }
        })
        expect(
          JSON.stringify(actual) === JSON.stringify(control),
        ).toMatchInlineSnapshot('true')
      } finally {
        await browser.close()
      }
    } finally {
      await Fs.rm(root, { recursive: true, force: true })
    }
  }, 120000)

  test('builds and updates native modules without web delivery', async () => {
    const { root, config } = await create({
      'config.ts': `import {Config} from 'zyzz';export const {style}=Config.create({theme:{color:{ink:{light:'#123456',dark:'#abcdef'}}}});`,
      'index.ts': `import {style} from './config.js';export const card=style({color:'ink',targets:{ios:{opacity:0.5},android:{opacity:0.8}}});export const props=card();`,
    })
    const context: { colorScheme: 'dark' | 'light'; platform: 'android' } = {
      colorScheme: 'dark',
      platform: 'android',
    }
    config.plugins = [zyzz({ native: context })]
    context.colorScheme = 'light'
    const server = await Vite.createServer(config)
    try {
      await server.listen()
      const output = await server.transformRequest('/index.ts')
      expect(output!.code.includes('zyzz:')).toMatchInlineSnapshot('false')
      expect(output!.code.includes('#abcdef')).toMatchInlineSnapshot('true')
      const html = await server.transformIndexHtml(
        '/index.html',
        '<html><head></head><body></body></html>',
      )
      expect(html.includes('localStorage')).toMatchInlineSnapshot('false')
      await Watch.write({
        path: Path.join(root, 'config.ts'),
        source: `import {Config} from 'zyzz';export const {style}=Config.create({theme:{color:{ink:{light:'#123456',dark:'#fedcba'}}}});`,
      })
      await vi.waitFor(async () => {
        const updated = await server.transformRequest('/index.ts')
        if (!updated!.code.includes('#fedcba'))
          throw new Error('Waiting for updated theme')
      })
      await server.close()
      await Vite.build({
        ...config,
        build: {
          lib: {
            entry: Path.join(root, 'index.ts'),
            formats: ['es'],
            fileName: () => 'native.mjs',
          },
        },
      })
      const files = await Fs.readdir(Path.join(root, 'dist'))
      expect(files).toMatchInlineSnapshot(`
[
  "native.mjs",
]
`)
      const exec = Util.promisify(ChildProcess.execFile)
      const result = await exec(process.execPath, [
        '--input-type=module',
        '-e',
        `import {props} from ${JSON.stringify(Path.join(root, 'dist/native.mjs'))};console.log(JSON.stringify(props));`,
      ])
      expect(JSON.parse(result.stdout)).toMatchInlineSnapshot(`
{
  "style": {
    "color": "#fedcba",
    "opacity": 0.8,
  },
}
`)
    } finally {
      await server.close()
      await Fs.rm(root, { recursive: true, force: true })
    }
  })

  test('rejects native output without source compilation', () => {
    expect(() =>
      zyzz({ compiler: false, native: { colorScheme: 'light' } }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Native builds require source compilation.]`,
    )
  })

  for (const configuration of [false, true]) {
    function source(value: string) {
      if (!configuration) return value

      return value
        .replace(
          '{ mint, props as libraryProps, style, theme }',
          '{ zyzz, props as libraryProps }',
        )
        .replace('{ mint, props, style, theme }', '{ zyzz, props }')
        .replace('{ style, theme }', '{ zyzz }')
        .replace(/\btheme\./g, 'zyzz.themes.base.')
        .replace(/\bmint\./g, 'zyzz.themes.mint.')
        .replace(/\bstyle\(/g, 'zyzz.style(')
        .replace('Theme.extend(theme,', 'Theme.extend(zyzz.themes.base,')
        .replaceAll('zyzz.zyzz.style', 'zyzz.style')
    }

    test(`packed ${configuration ? 'configurations' : 'themes'} retain types and compile through Vite package exports`, async () => {
      const directory = await Fs.mkdtemp(Path.resolve('.fixture-library-'))

      try {
        const root = await Library.create(directory, { configuration })

        await Fs.writeFile(
          Path.join(root, 'app.ts'),
          source(`import { mint, props as libraryProps, style, theme } from '@acme/theme';
import '@acme/theme/style.css';
export const props = style({color:theme.tokens.color.brand,padding:'md'})();
export const scope = mint.className;
export { libraryProps };
document.body.innerHTML = '<main class="' + scope + '"><div id="library" class="' + libraryProps.className + '"></div><div id="app" class="' + props.className + '"></div></main>';`),
        )
        await Fs.writeFile(
          Path.join(root, 'types.ts'),
          source(`import { style, theme } from '@acme/theme'; style({color:'brand',padding:'md'}); style({color:theme.tokens.color.brand});
// @ts-expect-error Unknown tokens remain invalid through packed declarations.
style({color:'missing'});
// @ts-expect-error Imported references preserve property domains.
style({padding:theme.tokens.color.brand});
${configuration ? "zyzz.style({'@layer components':{color:'brand'}});\n// @ts-expect-error Packed layer keys remain exact.\nzyzz.style({'@layer missing':{color:'brand'}});" : ''}`),
        )

        const checked = await Util.promisify(ChildProcess.execFile)(
          process.execPath,
          [
            Path.resolve('node_modules/typescript/bin/tsc'),
            '--ignoreConfig',
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
          /Theme\.define|theme\.tokens|\.style\(\{|zyzz\.json|Unsupported Zyzz contract/.test(
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
          source(`import { mint, props, style, theme } from '@acme/theme'; import { Theme } from 'zyzz'; import '@acme/theme/style.css';
const extended = Theme.extend(theme, {spacing:{md:'16px'}});
const app = style({color:'brand'})();
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

  test.each(['atomic', 'grouped'] as const)(
    'production leaves lazy styles in Vite dynamic chunks (%s)',
    async (cssOutput) => {
      const { config, root } = await create({
        ...Fixture.lazyFiles,
        'theme.ts': `import { Config } from 'zyzz'; export const { theme } = Config.create({ cssOutput: '${cssOutput}', theme: { color: { brand: '#06c' } } });`,
      })

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
          {
            css?: string[]
            dynamicImports?: string[]
            isDynamicEntry?: boolean
          }
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

        expect(javascript.includes('Theme.define')).toMatchInlineSnapshot(
          'false',
        )
        expect(
          javascript.includes('lazy source was executed'),
        ).toMatchInlineSnapshot('true')
      } finally {
        await Fs.rm(root, { recursive: true, force: true })
      }
    },
  )

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
        `"z-text-ju2ueN-0 z-p-ju2ueN-0"`,
      )
    } finally {
      await server.close()
      await Fs.rm(root, { recursive: true, force: true })
    }
  })

  test.each(['atomic', 'grouped'] as const)(
    'lazy CSS loads on demand and updates without reload in Chromium (%s)',
    async (cssOutput) => {
      const { config, root } = await create({
        ...Fixture.lazyFiles,
        'theme.ts': `import { Config } from 'zyzz'; export const { theme } = Config.create({ cssOutput: '${cssOutput}', theme: { color: { brand: '#06c' } } });`,
      })
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

        // Wait for startup document reloads before asserting edit-time node preservation.
        await page.waitForLoadState('networkidle')
        await page
          .locator('#card')
          .evaluate((element) => element.setAttribute('data-preserved', 'yes'))
        await Watch.write({
          path: Path.join(root, 'alternate.ts'),
          source: Fixture.files['alternate.ts'].replace('#175', '#f00'),
        })
        await page.waitForFunction(
          () =>
            getComputedStyle(document.querySelector('#card')!).color ===
            'rgb(255, 0, 0)',
        )

        await Watch.write({
          path: Path.join(root, 'card.ts'),
          source: Fixture.files['card.ts'].replace('8px', '16px'),
        })
        await page.waitForFunction(
          () =>
            getComputedStyle(document.querySelector('#card')!).padding ===
            '16px',
        )

        expect(
          await page.locator('#card').getAttribute('data-preserved'),
        ).toMatchInlineSnapshot('"yes"')
      } finally {
        await browser?.close()
        await server.close()
        await Fs.rm(root, { recursive: true, force: true })
      }
    },
    30000,
  )

  test.each(['atomic', 'grouped'] as const)(
    'production loads lazy HTML styles once on demand (%s)',
    async (cssOutput) => {
      const { config, root } = await create({
        ...Fixture.lazyFiles,
        'theme.ts': `import { Config } from 'zyzz'; export const { theme } = Config.create({ cssOutput: '${cssOutput}', theme: { color: { brand: '#06c' } } });`,
      })
      let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
      let preview: Vite.PreviewServer | undefined
      try {
        await Vite.build(config)
        preview = await Vite.preview({
          ...config,
          preview: { host: '127.0.0.1', port: 0 },
        })
        browser = await chromium.launch()
        const page = await browser.newPage()
        const sheets: string[] = []
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        page.on('request', (request) => {
          if (new URL(request.url()).pathname.endsWith('.css'))
            sheets.push(request.url())
        })
        await page.goto(preview.resolvedUrls!.local[0]!)
        const initialRequests = sheets.length
        expect(
          await page.evaluate(
            () =>
              [...document.styleSheets].flatMap((sheet) => [...sheet.cssRules])
                .length,
          ),
        ).toMatchInlineSnapshot('0')
        expect(
          await page.locator('#card').getAttribute('class'),
        ).toMatchInlineSnapshot('null')
        await page
          .locator('#card')
          .evaluate((element) => element.setAttribute('data-preserved', 'yes'))
        for (const iteration of [0, 1]) {
          if (iteration)
            await page
              .locator('#card')
              .evaluate((element) => element.removeAttribute('class'))
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
          expect(sheets.length - initialRequests).toMatchInlineSnapshot('1')
          expect(
            await page.locator('#card').getAttribute('data-preserved'),
          ).toMatchInlineSnapshot('"yes"')
        }
        expect(
          await page.evaluate((grouped) => {
            const card = document.querySelector('#card')!
            const rules = [...document.styleSheets]
              .flatMap((sheet) => [...sheet.cssRules])
              .filter(
                (rule): rule is CSSStyleRule =>
                  rule instanceof CSSStyleRule &&
                  card.matches(rule.selectorText) &&
                  rule.style.padding === '8px',
              )
            return (
              rules.length > 0 &&
              rules.every((rule) => Boolean(rule.style.color) === grouped)
            )
          }, cssOutput === 'grouped'),
        ).toMatchInlineSnapshot('true')
        expect(errors).toMatchInlineSnapshot('[]')
      } finally {
        await browser?.close()
        if (preview)
          await new Promise<void>((resolve, reject) =>
            preview!.httpServer.close((error) =>
              error ? reject(error) : resolve(),
            ),
          )
        await Fs.rm(root, { recursive: true, force: true })
      }
    },
    30000,
  )

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
        .z-text-VVV-uM{color:var(--z-t8emm311c7xzi9-theme-color_2e_brand,#06c);}
        .z-p-8px-rxmkdJ{padding:8px;}.z_theme-8emm311c7xzi9-theme{--z-t8emm311c7xzi9-theme-color_2e_brand:#06c;}
        .z_theme-wo97ow1iqyoeo-mint{--z-t8emm311c7xzi9-theme-color_2e_brand:#175;}
        .z-text-VVV-uM{color:var(--z-t8emm311c7xzi9-theme-color_2e_brand,#06c);}
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

  test('serves shared and module stylesheets with Vite CSS queries', async () => {
    const { config, root } = await create({
      ...Fixture.files,
      'main.ts':
        Fixture.files['main.ts'] +
        `import { style } from 'zyzz'; export const box = style({ margin: '2px' });`,
    })
    const server = await Vite.createServer(config)
    try {
      await server.listen()
      const address = server.httpServer!.address()
      if (!address || typeof address === 'string')
        throw new Error('Missing server port')
      const origin = `http://127.0.0.1:${address.port}`
      const code = await (await fetch(`${origin}/main.ts`)).text()
      const paths = [
        ...code.matchAll(/import\s*["']([^"']*zyzz:[^"']+\.css)["']/g),
      ].map((match) => match[1]!)
      expect(paths.length).toMatchInlineSnapshot(`2`)
      const stylesheets: string[] = []
      for (const path of paths) {
        const direct = await fetch(`${origin}${path}?direct`)
        expect(direct.status).toMatchInlineSnapshot(`200`)
        expect(direct.headers.get('content-type')).toContain('text/css')
        stylesheets.push(await direct.text())
        const inline = await fetch(`${origin}${path}?inline`)
        expect(inline.status).toMatchInlineSnapshot(`200`)
        expect(await inline.text()).toContain('export default')
      }
      expect(stylesheets.join('')).toContain('margin:2px')
    } finally {
      await server.close()
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
        `"z-text-ju2ueN-0 z-p-ju2ueN-0"`,
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

      const update = await message(
        socket,
        () =>
          Watch.write({
            path,
            source: Fixture.files['alternate.ts'].replace('#175', '#f00'),
          }),
        // Initial fixture creation can queue an unrelated document reload.
        (text) => text.includes('zyzz:'),
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

      // Wait for startup document reloads before asserting edit-time node preservation.
      await page.waitForLoadState('networkidle')
      await page.evaluate(() => {
        document.querySelector('#card')!.setAttribute('data-preserved', 'yes')
      })
      await Watch.write({
        path: Path.join(root, 'alternate.ts'),
        source: Fixture.files['alternate.ts'].replace('#175', '#f00'),
      })
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
  test('inlines configuration initialization before other head scripts in development and production', async () => {
    // An unrelated earlier module and layer-free configurations exercise whole-project discovery.
    const files = {
      'a.ts': 'export const unrelated = 1',
      'config.ts': `import { Config } from 'zyzz'; export const { style, themes } = Config.create({ defaultTheme: 'base', themes: { base: { color: { ink: '#123456' } }, mint: { color: { ink: '#008844' } } } }); export const other = Config.create({ defaultTheme: 'night', themes: { night: { color: { ink: '#000000' } }, 'brand.dark': { color: { ink: '#ffffff' } } } }); export const { script: onlyScript } = Config.create({ defaultTheme: 'solo', themes: { solo: { color: { ink: '#aabbcc' } } } });`,
      'index.html': `<!doctype html><html><head><title>Fixture</title></head><body><script type="module" src="/main.ts"></script></body></html>`,
      'main.ts': `import { themes } from './config'; const root = document.documentElement; root.dataset.initial = root.className; root.dataset.mint = themes.mint.className; root.dataset.ready = 'true';`,
    }
    const { config, root } = await create(files)
    const browser = await chromium.launch({ headless: true })
    let server: Vite.ViteDevServer | undefined
    let preview: Vite.PreviewServer | undefined

    try {
      server = await Vite.createServer(config)
      await server.listen()

      const development = await server.transformIndexHtml(
        '/index.html',
        files['index.html'],
      )
      const restore = development.indexOf('localStorage.getItem("zyzz")')

      expect(restore > -1).toMatchInlineSnapshot('true')
      expect(
        restore < development.indexOf('/@vite/client'),
      ).toMatchInlineSnapshot('true')

      const scripts = (html: string) =>
        html.split('localStorage.getItem("zyzz")').length - 1

      // Each configuration keeps its own catalog, dotted keys use the compiled
      // escaping, and a script-only export derives its catalog from the options.
      expect(scripts(development)).toMatchInlineSnapshot('3')
      expect(
        /z_theme-[a-z0-9]+-other-brand_2e_dark/.test(development),
      ).toMatchInlineSnapshot('true')
      expect(
        /\["solo","z_theme-[a-z0-9]+-onlyScript-solo"\]/.test(development),
      ).toMatchInlineSnapshot('true')

      // A source error stays with its module; the document still initializes
      // from the catalogs collected before the edit.
      await Fs.writeFile(
        Path.join(root, 'config.ts'),
        files['config.ts'].replace("'#123456'", 'unknownColor()'),
      )

      const broken = await server.transformIndexHtml(
        '/index.html',
        files['index.html'],
      )

      expect(scripts(broken)).toMatchInlineSnapshot('3')

      // An edit that drops the configuration import while failing to compile
      // keeps scoping the document through the last successful graph.
      await Fs.writeFile(Path.join(root, 'config.ts'), files['config.ts'])
      await Fs.writeFile(
        Path.join(root, 'main.ts'),
        `import { style } from 'zyzz'; export const broken = style({ color: unknownColor() });`,
      )

      const detached = await server.transformIndexHtml(
        '/index.html',
        files['index.html'],
      )

      expect(scripts(detached)).toMatchInlineSnapshot('3')

      await Fs.writeFile(Path.join(root, 'main.ts'), files['main.ts'])

      // Removed configurations leave the document on the next request.
      await Fs.writeFile(
        Path.join(root, 'config.ts'),
        files['config.ts'].slice(
          0,
          files['config.ts'].indexOf(' export const other'),
        ),
      )

      const reduced = await server.transformIndexHtml(
        '/index.html',
        files['index.html'],
      )

      expect(scripts(reduced)).toMatchInlineSnapshot('1')

      // A module that stops emitting a contract altogether drops its catalogs too.
      await Fs.writeFile(
        Path.join(root, 'config.ts'),
        `export const themes = { mint: { className: 'plain' } }`,
      )

      const detachedConfiguration = await server.transformIndexHtml(
        '/index.html',
        files['index.html'],
      )

      expect(scripts(detachedConfiguration)).toMatchInlineSnapshot('0')

      await Fs.writeFile(Path.join(root, 'config.ts'), files['config.ts'])
      await server.close()
      server = undefined

      const outDir = Path.join(root, 'dist')

      await Vite.build({ ...config, build: { outDir } })

      const production = await Fs.readFile(
        Path.join(outDir, 'index.html'),
        'utf8',
      )

      expect(
        /<head>\s*<script>\(\(\)=>\{try\{const value=JSON\.parse\(localStorage\.getItem\("zyzz"\)/.test(
          production,
        ),
      ).toMatchInlineSnapshot('true')

      preview = await Vite.preview({
        ...config,
        build: { outDir },
        preview: { host: '127.0.0.1', port: 0 },
      })

      const page = await browser.newPage()

      await page.goto(preview.resolvedUrls!.local[0]!)
      await page.waitForFunction(
        'document.documentElement.dataset.ready === "true"',
      )
      await page.evaluate(
        `localStorage.setItem('zyzz', JSON.stringify({ theme: 'mint', colorScheme: 'dark' }))`,
      )
      await page.reload()
      await page.waitForFunction(
        'document.documentElement.dataset.ready === "true"',
      )

      // The entry module observed the restored classes when it evaluated.
      expect(
        await page.evaluate(
          'document.documentElement.dataset.initial === `${document.documentElement.dataset.mint} z_scheme-dark`',
        ),
      ).toMatchInlineSnapshot('true')
      expect(
        await page.evaluate('document.documentElement.style.colorScheme'),
      ).toMatchInlineSnapshot('"dark"')

      await Vite.build({
        ...config,
        build: { outDir: Path.join(root, 'plain') },
        plugins: [zyzz({ script: false })],
      })

      expect(
        (
          await Fs.readFile(Path.join(root, 'plain/index.html'), 'utf8')
        ).includes('localStorage'),
      ).toMatchInlineSnapshot('false')
    } finally {
      await browser.close()
      await server?.close()

      if (preview)
        await new Promise<void>((resolve, reject) =>
          preview!.httpServer.close((error) =>
            error ? reject(error) : resolve(),
          ),
        )

      await Fs.rm(root, { recursive: true, force: true })
    }
  }, 60000)

  test('scopes built initialization scripts to the configurations each page bundles', async () => {
    const page = (entry: string) =>
      `<!doctype html><html><head><title>${entry}</title></head><body><script type="module" src="/${entry}.ts"></script></body></html>`
    const configuration = (name: string) =>
      `import { Config } from 'zyzz'; export const { style, themes } = Config.create({ defaultTheme: '${name}', storageKey: '${name}', themes: { ${name}: { color: { ink: '#123456' } } } });`
    // Each page imports only style, so its configuration module leaves the bundle.
    // Page c reaches its configuration only through a lazy import.
    const files = {
      'a.html': page('a'),
      'a.ts': `import { style } from './alpha'; document.body.className = style({ color: 'ink' })().className;`,
      'alpha.ts': configuration('alpha'),
      'b.html': page('b'),
      'b.ts': `import { style } from './beta'; document.body.className = style({ color: 'ink' })().className;`,
      'beta.ts': configuration('beta'),
      'c.html': page('c'),
      'c.ts': `void import('./gamma').then(({ style }) => { document.body.className = style({ color: 'ink' })().className; });`,
      // Page d reaches its entry through an inline module script.
      'd.html': `<!doctype html><html><head><title>d</title></head><body><script type="module">import './d.ts'</script></body></html>`,
      'd.ts': `import { style } from './delta'; document.body.className = style({ color: 'ink' })().className;`,
      'delta.ts': configuration('delta'),
      // Page e reaches its entry through an aliased inline import.
      'e.html': `<!doctype html><html><head><title>e</title></head><body><script type="module">import '@pages/e.ts'</script></body></html>`,
      'e.ts': `import { style } from './epsilon'; document.body.className = style({ color: 'ink' })().className;`,
      'epsilon.ts': configuration('epsilon'),
      'gamma.ts': configuration('gamma'),
      // Without a package.json the repository's sideEffects list would let the bundler drop a side-effect import.
      'package.json': '{ "name": "pages", "private": true, "type": "module" }',
    }
    const { config: base, root } = await create(files)
    const config: Vite.InlineConfig = {
      ...base,
      resolve: { alias: { ...base.resolve?.alias, '@pages': root } },
    }
    let server: Vite.ViteDevServer | undefined

    const keys = (html: string) =>
      ['alpha', 'beta', 'gamma', 'delta', 'epsilon'].filter((key) =>
        html.includes(`localStorage.getItem("${key}")`),
      )

    try {
      // The dev server follows each document's module scripts through the compiled graph.
      server = await Vite.createServer(config)
      await server.listen()

      expect(keys(await server.transformIndexHtml('/a.html', files['a.html'])))
        .toMatchInlineSnapshot(`
        [
          "alpha",
        ]
      `)
      expect(keys(await server.transformIndexHtml('/b.html', files['b.html'])))
        .toMatchInlineSnapshot(`
        [
          "beta",
        ]
      `)
      expect(keys(await server.transformIndexHtml('/c.html', files['c.html'])))
        .toMatchInlineSnapshot(`
        [
          "gamma",
        ]
      `)
      expect(keys(await server.transformIndexHtml('/d.html', files['d.html'])))
        .toMatchInlineSnapshot(`
          [
            "delta",
          ]
        `)
      expect(keys(await server.transformIndexHtml('/e.html', files['e.html'])))
        .toMatchInlineSnapshot(`
          [
            "epsilon",
          ]
        `)

      await server.close()
      server = undefined

      const outDir = Path.join(root, 'dist')

      await Vite.build({
        ...config,
        build: {
          outDir,
          rollupOptions: {
            input: {
              a: Path.join(root, 'a.html'),
              b: Path.join(root, 'b.html'),
              c: Path.join(root, 'c.html'),
              d: Path.join(root, 'd.html'),
              e: Path.join(root, 'e.html'),
            },
          },
        },
      })

      expect(keys(await Fs.readFile(Path.join(outDir, 'a.html'), 'utf8')))
        .toMatchInlineSnapshot(`
        [
          "alpha",
        ]
      `)
      expect(keys(await Fs.readFile(Path.join(outDir, 'b.html'), 'utf8')))
        .toMatchInlineSnapshot(`
        [
          "beta",
        ]
      `)
      expect(keys(await Fs.readFile(Path.join(outDir, 'c.html'), 'utf8')))
        .toMatchInlineSnapshot(`
        [
          "gamma",
        ]
      `)
      expect(keys(await Fs.readFile(Path.join(outDir, 'd.html'), 'utf8')))
        .toMatchInlineSnapshot(`
          [
            "delta",
          ]
        `)
      expect(keys(await Fs.readFile(Path.join(outDir, 'e.html'), 'utf8')))
        .toMatchInlineSnapshot(`
          [
            "epsilon",
          ]
        `)
    } finally {
      await server?.close()
      await Fs.rm(root, { recursive: true, force: true })
    }
  }, 60000)
  test('initializes packed configurations reached only through another packed contract', async () => {
    const files = {
      'index.html': `<!doctype html><html><head><title>Fixture</title></head><body><script type="module" src="/main.ts"></script></body></html>`,
      'main.ts': `import 'wrapper'; document.documentElement.dataset.ready = 'true';`,
    }
    const { config, root } = await create(files)

    try {
      // The dependency owns a configuration and a shared contribution; the
      // wrapper repacks that contribution, so its contract names the dependency.
      const dependency = Graph.compile({
        modules: {
          'index.ts': `import { Config } from 'zyzz'; import { global } from 'zyzz/web'; global({ body: { margin: 0 } }); export const { style, themes } = Config.create({ defaultTheme: 'nested', storageKey: 'nested', themes: { nested: { color: { ink: '#123456' } } } });`,
        },
      })
      const wrapper = Graph.compile({
        contracts: { 'dep/index.js': dependency.contracts['index.ts']! },
        imports: { 'wrapper/index.ts': { dep: 'dep/index.js' } },
        modules: {
          'wrapper/index.ts': `import 'dep'; export const loaded = true;`,
        },
      })
      const wrapperRoot = Path.join(root, 'node_modules/wrapper')
      const dependencyRoot = Path.join(wrapperRoot, 'node_modules/dep')

      for (const [directory, name, module, contract] of [
        [
          dependencyRoot,
          'dep',
          dependency.modules['index.ts']!.code,
          dependency.contracts['index.ts']!,
        ],
        [
          wrapperRoot,
          'wrapper',
          wrapper.modules['wrapper/index.ts']!.code,
          wrapper.contracts['wrapper/index.ts']!,
        ],
      ] as const) {
        await Fs.mkdir(directory, { recursive: true })
        await Fs.writeFile(
          Path.join(directory, 'package.json'),
          JSON.stringify({
            name,
            type: 'module',
            exports: './index.js',
            sideEffects: false,
          }),
        )
        await Fs.writeFile(
          Path.join(directory, 'index.js'),
          Esbuild.transformSync(module, { loader: 'ts', format: 'esm' }).code,
        )
        await Fs.writeFile(Path.join(directory, 'index.js.zyzz.json'), contract)
      }

      const outDir = Path.join(root, 'dist')

      await Vite.build({ ...config, build: { outDir } })

      const html = await Fs.readFile(Path.join(outDir, 'index.html'), 'utf8')

      expect(
        html.includes('localStorage.getItem("nested")'),
      ).toMatchInlineSnapshot('true')
    } finally {
      await Fs.rm(root, { recursive: true, force: true })
    }
  }, 60000)
})
