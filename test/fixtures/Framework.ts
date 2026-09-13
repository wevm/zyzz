/** Verifies real framework consumers through types, Vite, SSR, and Chromium. @module */
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

    for (const [name, content] of Object.entries(options.files))
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
      build: { cssTarget: 'esnext' },
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

    const page = await browser.newPage({
      viewport: { width: 500, height: 800 },
    })
    const errors: string[] = []

    page.on('pageerror', (error) => errors.push(error.message))

    for (const production of [false, true]) {
      if (production) {
        await server!.close()
        server = undefined
        await Vite.build(config)
        preview = await Vite.preview({
          ...config,
          preview: { host: '127.0.0.1', port: 0 },
        })
      }

      const url = production
        ? preview!.resolvedUrls!.local[0]!
        : server!.resolvedUrls!.local[0]!

      await page.setViewportSize({ width: 500, height: 800 })
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
      )

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

      const recipe = page.locator('#recipe')
      const inspectRecipe = () =>
        recipe.evaluate((element) => {
          const style = getComputedStyle(element)
          return [style.padding, style.opacity, style.fontWeight]
        })
      expect(await inspectRecipe()).toEqual([
        production ? '6px' : '4px',
        '1',
        '400',
      ])
      expect(await page.locator('#empty').getAttribute('data-size')).toBeNull()
      expect(
        await page
          .locator('#empty')
          .evaluate((element) => getComputedStyle(element).padding),
      ).toBe('2px')
      const ruleCount = await page.evaluate(() =>
        [...document.styleSheets].reduce(
          (total, sheet) => total + sheet.cssRules.length,
          0,
        ),
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

      expect(await inspectRecipe()).toEqual([
        '12px 12px 12px 3px',
        '0.5',
        '700',
      ])
      expect(await recipe.getAttribute('data-size')).toBe('custom')
      await page.setViewportSize({ width: 800, height: 800 })
      await page.waitForFunction(
        'getComputedStyle(document.querySelector("#recipe")).opacity === "1"',
      )
      expect(await inspectRecipe()).toEqual(['12px 12px 12px 3px', '1', '400'])
      await page.setViewportSize({ width: 500, height: 800 })
      await page.waitForFunction(
        'getComputedStyle(document.querySelector("#recipe")).opacity === "0.5"',
      )

      await page.locator('#toggle').click()
      await page.waitForFunction(
        'getComputedStyle(document.querySelector("#card")).width === "100px"',
      )
      expect(await inspectRecipe()).toEqual([
        production ? '6px' : '4px',
        '1',
        '400',
      ])
      expect(await recipe.getAttribute('data-size')).toBe('sm')
      expect(await recipe.getAttribute('style')).toBeFalsy()
      expect(
        await page.evaluate(() =>
          [...document.styleSheets].reduce(
            (total, sheet) => total + sheet.cssRules.length,
            0,
          ),
        ),
      ).toBe(ruleCount)

      if (!production) {
        await Fs.writeFile(
          Path.join(root, 'styles.ts'),
          options.files['styles.ts']
            .replace('#0066cc', '#117755')
            .replace("sm: { padding: '4px' }", "sm: { padding: '6px' }"),
        )
        await page.waitForFunction(
          'getComputedStyle(document.querySelector("#card")).backgroundColor === "rgb(17, 119, 85)"',
        )
      }

      await page.waitForFunction(
        'document.querySelector("#card")?.isConnected && getComputedStyle(document.querySelector("#card")).backgroundColor === "rgb(17, 119, 85)"',
      )

      expect(
        await page.evaluate(
          'getComputedStyle(document.querySelector("#card")).backgroundColor',
        ),
      ).toMatchInlineSnapshot(`"rgb(17, 119, 85)"`)

      await page.waitForFunction(
        'getComputedStyle(document.querySelector("#recipe")).padding === "6px"',
      )

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

    await Fs.rm(root, { force: true, recursive: true })
  }
}

/** Inputs supplied by each real framework fixture. */
export declare namespace verify {
  type Options = {
    /** Exact consumer dependency versions. */
    dependencies: Record<string, string>
    /** Application modules and type-contract probes. */
    files: Record<string, string> & { 'styles.ts': string }
    /** JSX type provider when the framework uses JSX. */
    jsxImportSource?: string
    /** Temporary consumer identity. */
    name: string
    /** Installed official Vite plugin package. */
    plugin: string
    /** Named plugin export, or default. */
    pluginExport?: string
    /** Framework plugin configuration. */
    pluginOptions?: Record<string, unknown>
  }
}
