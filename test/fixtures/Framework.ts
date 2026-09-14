/** Verifies real framework consumers through types, Vite, SSR, and Chromium. @module */
import * as Trace from '@jridgewell/trace-mapping'
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Module from 'node:module'
import * as Path from 'node:path'
import * as Url from 'node:url'
import * as Util from 'node:util'
import { chromium } from 'playwright'
import * as Vite from 'vite'
import { expect } from 'vite-plus/test'
import { zyzz } from 'zyzz/vite'
import * as VariantLibrary from './VariantLibrary.js'

/** Runs the shared consumer contract against an installed framework compiler. */
export async function verify(options: verify.Options) {
  const root = await Fs.mkdtemp(Path.resolve(`.fixture-${options.name}-`))
  const exec = Util.promisify(ChildProcess.execFile)
  let server: Vite.ViteDevServer | undefined
  let preview: Vite.PreviewServer | undefined
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined

  try {
    await Fs.writeFile(
      Path.join(root, 'package.json'),
      JSON.stringify({
        private: true,
        type: 'module',
        dependencies: options.dependencies,
      }),
    )
    await exec(
      'npm',
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--package-lock=false',
      ],
      { cwd: root, timeout: 120000 },
    )

    await VariantLibrary.create(root, {
      output: options.output ?? 'html',
      cssOutput: options.cssOutput === 'atomic' ? 'grouped' : 'atomic',
    })

    const files = {
      ...options.files,
      'styles.ts': options.files['styles.ts'].replace(
        'Config.create({',
        `Config.create({ cssOutput: '${options.cssOutput}',`,
      ),
    }
    for (const [name, content] of Object.entries(files))
      await Fs.writeFile(Path.join(root, name), content)

    const require = Module.createRequire(Path.join(root, 'package.json'))

    const pluginModule = (await import(
      Url.pathToFileURL(require.resolve(options.plugin)).href
    )) as Record<
      string,
      (options: Record<string, unknown>) => Vite.PluginOption
    >

    const framework = pluginModule[options.pluginExport ?? 'default']!

    const config: Vite.InlineConfig = {
      build: { cssTarget: 'chrome123' },
      configFile: false,
      logLevel: 'silent',
      plugins: [zyzz(), framework(options.pluginOptions ?? {})],
      resolve: {
        alias: {
          'zyzz/runtime': Path.resolve('src/runtime/index.ts'),
          'zyzz/web': Path.resolve('src/web/index.ts'),
        },
      },
      root,
      server: { fs: { allow: [process.cwd()] }, host: '127.0.0.1', port: 0 },
    }

    await Fs.writeFile(
      Path.join(root, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          customConditions: ['src'],
          jsx: 'preserve',
          ...(options.jsxImportSource
            ? { jsxImportSource: options.jsxImportSource }
            : {}),
          module: 'esnext',
          moduleResolution: 'bundler',
          noEmit: true,
          skipLibCheck: true,
          strict: true,
          target: 'esnext',
          paths: {
            zyzz: [Path.resolve('src/index.ts')],
            'zyzz/web': [Path.resolve('src/web/index.ts')],
          },
        },
        include: ['types.tsx', 'styles.ts'],
      }),
    )

    const checked = await exec(
      process.execPath,
      [
        Path.resolve('node_modules/typescript/bin/tsc'),
        '--project',
        Path.join(root, 'tsconfig.json'),
      ],
      { timeout: 120000 },
    )

    expect(checked.stdout).toMatchInlineSnapshot(`""`)

    server = await Vite.createServer(config)
    await server.listen()

    const ssr = (await server.ssrLoadModule('/server.tsx')) as {
      render: () =>
        | { html: string; script: string }
        | Promise<{ html: string; script: string }>
    }

    const rendered = await ssr.render()

    expect(rendered.html.includes('class=')).toMatchInlineSnapshot(`true`)
    expect(rendered.html.includes('className=')).toMatchInlineSnapshot(`false`)

    await Fs.writeFile(
      Path.join(root, 'index.html'),
      `<!doctype html><html><head>${rendered.script}</head><body><div id="app">${rendered.html}</div><button id="dispose">Dispose</button><script type="module" src="/client.tsx"></script></body></html>`,
    )
    browser = await chromium.launch({ headless: true })

    const page = await browser.newPage()
    const errors: string[] = []

    page.on('pageerror', (error) => errors.push(error.message))

    for (const production of [false, true]) {
      if (production) {
        await server!.close()
        server = undefined
        const directory = Path.join(root, 'server-dist')
        await Vite.build({
          ...config,
          build: {
            ...config.build,
            outDir: directory,
            ssr: Path.join(root, 'server.tsx'),
          },
          ssr: { noExternal: ['@acme/variants'] },
        })
        const productionServer = (await import(
          Url.pathToFileURL(Path.join(directory, 'server.js')).href
        )) as typeof ssr
        const rendered = await productionServer.render()
        await Fs.writeFile(
          Path.join(root, 'index.html'),
          `<!doctype html><html><head>${rendered.script}</head><body><div id="app">${rendered.html}</div><button id="dispose">Dispose</button><script type="module" src="/client.tsx"></script></body></html>`,
        )
        await Vite.build(config)
        preview = await Vite.preview({
          ...config,
          preview: { host: '127.0.0.1', port: 0 },
        })
      }

      const url = production
        ? preview!.resolvedUrls!.local[0]!
        : server!.resolvedUrls!.local[0]!

      await page.setViewportSize({ width: 450, height: 700 })
      await page.goto(url)

      if (!production) {
        const optimizer = server!.environments.client.depsOptimizer

        await optimizer?.scanProcessing
        await Promise.all(
          Object.values({
            ...optimizer?.metadata.optimized,
            ...optimizer?.metadata.discovered,
          }).flatMap((dependency) =>
            dependency.processing ? [dependency.processing] : [],
          ),
        )
        await page.waitForLoadState('networkidle')
      }

      await page.waitForFunction(
        'document.documentElement.dataset.ready === "true"',
      )

      expect(
        await page.evaluate('document.documentElement.dataset.identity'),
      ).toMatchInlineSnapshot(`"true"`)

      await page.waitForFunction(
        'getComputedStyle(document.querySelector("#card")).width === "100px"',
      ).catch(async (error) => {
        const detail = await page.locator('#card').evaluate(element => ({ html: element.outerHTML, width: getComputedStyle(element).width, rules: [...document.styleSheets].flatMap(sheet => [...sheet.cssRules].map(rule => rule.cssText)).filter(rule => [...element.classList].some(name => rule.includes(name))) }))
        throw new Error(`${String(error)}\n${JSON.stringify({ production, errors, detail })}`)
      })

      expect(
        await page
          .locator('#card')
          .evaluate((element) => getComputedStyle(element).width),
      ).toMatchInlineSnapshot(`"100px"`)
      expect(
        await page
          .locator('#card')
          .evaluate((element) => getComputedStyle(element).marginTop),
      ).toMatchInlineSnapshot(`"12px"`)
      expect(
        await page
          .locator('#card')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(0, 0, 0)"`)

      expect(
        await page
          .locator('#variant')
          .evaluate((element) => getComputedStyle(element).paddingLeft),
      ).toMatchInlineSnapshot('"3px"')
      expect(
        await page
          .locator('#variant')
          .evaluate((element) => getComputedStyle(element).paddingRight),
      ).toMatchInlineSnapshot('"4px"')
      await page.evaluate(
        'window.variantNode=document.querySelector("#variant")',
      )

      await page.evaluate('window.original = document.querySelector("#card")')
      await page.locator('#toggle').click()
      await page.waitForFunction(
        'getComputedStyle(document.querySelector("#card")).width === "300px"',
      )

      expect(
        await page.evaluate(
          'window.original === document.querySelector("#card")',
        ),
      ).toMatchInlineSnapshot(`true`)
      expect(
        await page
          .locator('#card')
          .evaluate((element) => getComputedStyle(element).marginTop),
      ).toMatchInlineSnapshot(`"0px"`)
      expect(
        await page
          .locator('#card')
          .evaluate((element) =>
            (element as HTMLElement).style.getPropertyValue('--note'),
          ),
      ).toMatchInlineSnapshot(`""`)
      expect(
        await page
          .locator('#card')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(255, 255, 255)"`)

      expect(
        await page
          .locator('#variant')
          .evaluate((element) => getComputedStyle(element).paddingRight),
      ).toMatchInlineSnapshot('"20px"')
      expect(
        await page
          .locator('#variant')
          .evaluate((element) => getComputedStyle(element).borderTopWidth),
      ).toMatchInlineSnapshot('"3px"')
      expect(
        await page.evaluate(
          'window.variantNode===document.querySelector("#variant")',
        ),
      ).toMatchInlineSnapshot('true')
      await page.setViewportSize({ width: 900, height: 700 })
      expect(
        await page
          .locator('#variant')
          .evaluate((element) => getComputedStyle(element).paddingRight),
      ).toMatchInlineSnapshot('"12px"')
      await page.setViewportSize({ width: 450, height: 700 })

      await page.locator('#toggle').click()
      await page.waitForFunction(
        'getComputedStyle(document.querySelector("#card")).width === "100px"',
      ).catch(async (error) => {
        const detail = await page.locator('#card').evaluate(element => ({ html: element.outerHTML, width: getComputedStyle(element).width, rules: [...document.styleSheets].flatMap(sheet => [...sheet.cssRules].map(rule => rule.cssText)).filter(rule => [...element.classList].some(name => rule.includes(name))) }))
        throw new Error(`${String(error)}\n${JSON.stringify({ production, errors, detail })}`)
      })

      expect(
        await page
          .locator('#variant')
          .evaluate((element) => getComputedStyle(element).paddingRight),
      ).toMatchInlineSnapshot('"4px"')
      expect(
        await page
          .locator('#variant')
          .evaluate((element) => (element as HTMLElement).style.length),
      ).toMatchInlineSnapshot('0')

      if (!production) {
        const prefix = files['styles.ts']
          .slice(0, files['styles.ts'].indexOf('backgroundColor'))
          .split('\n')
        let traced = false
        for (const module of server!.environments.client.moduleGraph.idToModuleMap.values()) {
          if (!module.id?.startsWith('\0zyzz:')) continue
          const loaded = await server!.environments.client.pluginContainer.load(
            module.id,
          )
          if (!loaded || typeof loaded === 'string' || !loaded.map) continue
          const map = new Trace.TraceMap(
            typeof loaded.map === 'string'
              ? loaded.map
              : JSON.stringify(loaded.map),
          )
          Trace.eachMapping(map, (mapping) => {
            if (
              mapping.source?.replaceAll('\\', '/').endsWith('/styles.ts') &&
              mapping.originalLine === prefix.length &&
              mapping.originalColumn === prefix.at(-1)!.length
            )
              traced = true
          })
        }
        expect(traced).toMatchInlineSnapshot('true')
      }

      if (!production) {
        const errorStart = errors.length
        await Fs.writeFile(
          Path.join(root, 'styles.ts'),
          files['styles.ts'].replace("'#0066cc'", 'unknownColor()'),
        )
        const overlay = await page.waitForFunction(() =>
          document
            .querySelector('vite-error-overlay')
            ?.shadowRoot?.textContent?.includes('styles.ts'),
        )
        expect(await overlay.jsonValue()).toMatchInlineSnapshot('true')
        await Fs.writeFile(
          Path.join(root, 'styles.ts'),
          files['styles.ts'].replace('#0066cc', '#117755'),
        )
        await page.locator('vite-error-overlay').waitFor({ state: 'detached' })
        await page.waitForFunction(
          'getComputedStyle(document.querySelector("#card")).backgroundColor === "rgb(17, 119, 85)"',
        )
        // Svelte's HMR client may report a missing module while its dependency is deliberately invalid.
        const recoveryErrors = errors.splice(errorStart)
        expect(
          recoveryErrors.every(
            (error) =>
              options.name === 'svelte' &&
              error ===
                "Cannot read properties of undefined (reading 'default')",
          ),
        ).toMatchInlineSnapshot('true')
      }

      await page.waitForFunction(
        'document.querySelector("#card")?.isConnected && getComputedStyle(document.querySelector("#card")).backgroundColor === "rgb(17, 119, 85)"',
      )

      expect(
        await page.evaluate(
          'getComputedStyle(document.querySelector("#card")).backgroundColor',
        ),
      ).toMatchInlineSnapshot(`"rgb(17, 119, 85)"`)

      await page.locator('#dispose').click()
      await page.waitForFunction(
        'document.querySelector("#app").childElementCount === 0',
      )
    }

    expect(errors).toMatchInlineSnapshot(`[]`)
  } finally {
    await browser?.close()
    await server?.close()

    if (preview)
      await new Promise<void>((resolve, reject) =>
        preview!.httpServer.close((error) =>
          error ? reject(error) : resolve(),
        ),
      )

    await Fs.rm(root, {
      force: true,
      recursive: true,
      maxRetries: 5,
      retryDelay: 100,
    })
  }
}

/** Inputs supplied by each real framework fixture. */
export declare namespace verify {
  type Options = {
    /** Consumer mode; the packed producer uses the opposite representation. */
    cssOutput: 'atomic' | 'grouped'
    /** Exact consumer dependency versions. */
    dependencies: Record<string, string>
    /** Application modules and type-contract probes. */
    files: Record<string, string> & { 'styles.ts': string }
    /** JSX type provider when the framework uses JSX. */
    jsxImportSource?: string
    /** Temporary consumer identity. */
    name: string
    /** Renderer output used by the packed variant publisher. */
    output?: 'html' | 'react'
    /** Installed official Vite plugin package. */
    plugin: string
    /** Named plugin export, or default. */
    pluginExport?: string
    /** Framework plugin configuration. */
    pluginOptions?: Record<string, unknown>
  }
}
