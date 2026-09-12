/** Verifies real framework consumers through types, Vite, SSR, and Chromium. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Module from 'node:module'
import * as Path from 'node:path'
import * as Url from 'node:url'
import * as Util from 'node:util'
import * as Trace from '@jridgewell/trace-mapping'
import { chromium } from 'playwright'
import * as Vite from 'vite'
import { expect } from 'vite-plus/test'
import { zyzz } from 'zyzz/vite'
import * as Library from './Library.js'

const exec = Util.promisify(ChildProcess.execFile)

/**
 * Installs a framework consumer with pinned dependencies and the shared Vite configuration.
 * Callers close the returned application after success or failure.
 */
export async function create(
  options: create.Options,
): Promise<create.ReturnType> {
  const root = await Fs.mkdtemp(Path.resolve(`.fixture-${options.name}-`))

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

    // The publisher lives in a dot directory so eager discovery skips its compiled source.
    if (options.library) {
      const tarball = await Library.pack(Path.join(root, '.publisher'), {
        output: 'html',
      })

      await exec(
        'npm',
        [
          'install',
          tarball,
          '--offline',
          '--ignore-scripts',
          '--no-audit',
          '--no-fund',
          '--package-lock=false',
        ],
        { cwd: root, timeout: 120000 },
      )
    }

    for (const [name, content] of Object.entries(options.files))
      await Fs.writeFile(Path.join(root, name), content)

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
            'zyzz/runtime': [Path.resolve('src/runtime/index.ts')],
            'zyzz/web': [Path.resolve('src/web/index.ts')],
          },
        },
        include: ['types.tsx', 'styles.ts'],
      }),
    )

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
      // The packed library imports the repository runtime through the alias above,
      // which only applies to modules Vite transforms.
      ...(options.library ? { ssr: { noExternal: ['@acme/theme'] } } : {}),
    }

    return {
      close: () => Fs.rm(root, { force: true, recursive: true }),
      config,
      options,
      root,
    }
  } catch (error) {
    await Fs.rm(root, { force: true, recursive: true })
    throw error
  }
}

/** Inputs supplied by each real framework fixture. */
export declare namespace create {
  type Options = {
    /** Exact consumer dependency versions. */
    dependencies: Record<string, string>
    /** Module holding the edited `#0066cc` background, defaulting to `styles.ts`. */
    edited?: string
    /** Application modules and type-contract probes. */
    files: Record<string, string> & { 'styles.ts': string }
    /** JSX type provider when the framework uses JSX. */
    jsxImportSource?: string
    /** Installs the packed `@acme/theme` HTML-output library into the consumer. */
    library?: boolean
    /** Temporary consumer identity. */
    name: string
    /** Installed official Vite plugin package. */
    plugin: string
    /** Named plugin export, or default. */
    pluginExport?: string
    /** Framework plugin configuration. */
    pluginOptions?: Record<string, unknown>
  }

  type ReturnType = {
    /** Removes the temporary consumer. */
    close: () => Promise<void>
    /** Shared Vite configuration for development, build, and preview. */
    config: Vite.InlineConfig
    /** Fixture inputs. */
    options: Options
    /** Consumer directory. */
    root: string
  }
}

/**
 * Runs the shared consumer contract: consumer types, SSR markup, hydration identity,
 * reactive updates, theme schemes, development CSS edits, and production assets.
 */
export async function verify(app: create.ReturnType) {
  const { config, options, root } = app
  const edited = options.edited ?? 'styles.ts'
  let server: Vite.ViteDevServer | undefined
  let preview: Vite.PreviewServer | undefined
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined

  try {
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

    const rendered = await render(app, server)

    expect(rendered.html.includes('class=')).toMatchInlineSnapshot(`true`)
    expect(rendered.html.includes('className=')).toMatchInlineSnapshot(`false`)

    // The compiled class literal traces back to the authored css call.
    const transformed = await server.transformRequest(`/${edited}`)
    if (!transformed?.map || !('version' in transformed.map))
      throw new Error(`Missing source map for ${edited}`)

    const className = /z-[a-z0-9]+-base0/.exec(transformed.code)?.[0]
    if (!className)
      throw new Error('Missing compiled class in transformed code')

    const before = transformed.code.slice(
      0,
      transformed.code.indexOf(className),
    )
    const location = Trace.originalPositionFor(
      new Trace.TraceMap(transformed.map as Trace.EncodedSourceMap),
      {
        column: before.length - (before.lastIndexOf('\n') + 1),
        line: before.split('\n').length,
      },
    )
    const authored =
      options.files[edited]!.split('\n').findIndex((line) =>
        line.includes('#0066cc'),
      ) + 1

    // Vite names sources relative to the module; a raw absolute path also counts.
    expect(
      location.source !== null &&
        Path.relative(root, Path.resolve(root, location.source)) === edited,
    ).toMatchInlineSnapshot(`true`)
    expect(location.line === authored).toMatchInlineSnapshot(`true`)

    browser = await chromium.launch({ headless: true })

    const page = await browser.newPage()
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

      await page.goto(url)

      if (!production) await settle(server!, page)

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

      await page.locator('#toggle').click()
      await page.waitForFunction(
        'getComputedStyle(document.querySelector("#card")).width === "100px"',
      )

      if (!production) {
        await Fs.writeFile(
          Path.join(root, edited),
          options.files[edited]!.replace('#0066cc', '#117755'),
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

      await page.locator('#dispose').click()
      await page.waitForFunction(
        'document.querySelector("#app").childElementCount === 0',
      )
    }

    expect(errors).toMatchInlineSnapshot(`[]`)

    // The framework stays a consumer dependency; the package graph never lists it.
    const manifest = JSON.parse(
      await Fs.readFile(Path.resolve('package.json'), 'utf8'),
    ) as {
      dependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    }

    expect(
      Object.keys({
        ...manifest.dependencies,
        ...manifest.peerDependencies,
      }).filter((name) => name in options.dependencies),
    ).toMatchInlineSnapshot(`[]`)

    if (options.library) {
      const scripts = await Promise.all(
        (await Fs.readdir(Path.join(root, 'dist/assets')))
          .filter((name) => name.endsWith('.js'))
          .map((name) =>
            Fs.readFile(Path.join(root, 'dist/assets', name), 'utf8'),
          ),
      )

      // Packed contracts compile from metadata; authoring code stays out of the bundle.
      expect(
        /Config\.create|theme\.tokens|zyzz\.json|Unsupported Zyzz contract/.test(
          scripts.join('\n'),
        ),
      ).toMatchInlineSnapshot(`false`)
    }
  } finally {
    await browser?.close()
    await server?.close()

    if (preview)
      await new Promise<void>((resolve, reject) =>
        preview!.httpServer.close((error) =>
          error ? reject(error) : resolve(),
        ),
      )
  }
}

/**
 * Renames, removes, and recreates the configuration module under the development
 * server. Failed rebuilds keep the last good styles in the page; each fix applies
 * without a reload, and the component still responds afterwards.
 * @returns Page errors raised while updates failed, for the caller to snapshot.
 */
export async function recover(
  app: create.ReturnType,
): Promise<readonly string[]> {
  const { config, options, root } = app
  const server = await Vite.createServer(config)
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  let socket: WebSocket | undefined

  try {
    await server.listen()
    await render(app, server)

    const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, '')
    const transformed = await server.transformRequest('/styles.ts')
    const cssPath = transformed?.code.match(
      /import\s*["']([^"']*zyzz:(?!shared\.css)[^"']+\.css)["']/,
    )?.[1]
    if (!cssPath) throw new Error('Missing CSS import in styles.ts')

    const stylesheet = () => fetch(origin + cssPath)
    const status = async () => (await stylesheet()).status

    socket = new WebSocket(
      `${origin.replace('http', 'ws')}/?token=${server.config.webSocketToken}`,
      'vite-hmr',
    )
    await new Promise<void>((resolve, reject) => {
      socket!.onopen = () => resolve()
      socket!.onerror = () => reject(new Error('WebSocket failed'))
    })

    browser = await chromium.launch({ headless: true })

    const page = await browser.newPage()
    const errors: string[] = []

    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(server.resolvedUrls!.local[0]!)
    await settle(server, page)
    await page.waitForFunction(
      'document.documentElement.dataset.ready === "true"',
    )
    await page.waitForFunction(
      'getComputedStyle(document.querySelector("#card")).backgroundColor === "rgb(0, 102, 204)"',
    )

    const styles = (color: string, config: string) =>
      options.files['styles.ts']
        .replace('#0066cc', color)
        .replace("'./config'", `'./${config}'`)
    const background = () =>
      page.evaluate(
        'getComputedStyle(document.querySelector("#card")).backgroundColor',
      )

    await message(socket, () =>
      Fs.writeFile(Path.join(root, 'styles.ts'), styles('#117755', 'config')),
    )
    await page.waitForFunction(
      'getComputedStyle(document.querySelector("#card")).backgroundColor === "rgb(17, 119, 85)"',
    )

    // A rename raises separate unlink and create events; wait for the failed rebuild.
    await message(socket, () =>
      Fs.rename(
        Path.join(root, 'config.ts'),
        Path.join(root, 'zyzz.config.ts'),
      ),
    )
    await expect.poll(status, { timeout: 10000 }).toBe(500)

    expect(await status()).toMatchInlineSnapshot(`500`)
    expect(await background()).toMatchInlineSnapshot(`"rgb(17, 119, 85)"`)

    await message(socket, () =>
      Fs.writeFile(
        Path.join(root, 'styles.ts'),
        styles('#225599', 'zyzz.config'),
      ),
    )
    await page.waitForFunction(
      'getComputedStyle(document.querySelector("#card")).backgroundColor === "rgb(34, 85, 153)"',
    )

    await message(socket, () => Fs.rm(Path.join(root, 'zyzz.config.ts')))
    await expect.poll(status, { timeout: 10000 }).toBe(500)

    expect(await status()).toMatchInlineSnapshot(`500`)
    expect(await background()).toMatchInlineSnapshot(`"rgb(34, 85, 153)"`)

    await message(socket, () =>
      Fs.writeFile(
        Path.join(root, 'zyzz.config.ts'),
        options.files['config.ts']!.replace('#000000', '#ff0000'),
      ),
    )
    await page.waitForFunction(
      'getComputedStyle(document.querySelector("#card")).color === "rgb(255, 0, 0)"',
    )

    expect(await status()).toMatchInlineSnapshot(`200`)
    expect(await background()).toMatchInlineSnapshot(`"rgb(34, 85, 153)"`)

    await page.locator('#toggle').click()
    await page.waitForFunction(
      'getComputedStyle(document.querySelector("#card")).width === "300px"',
    )

    expect(
      await page
        .locator('#card')
        .evaluate((element) => getComputedStyle(element).color),
    ).toMatchInlineSnapshot(`"rgb(255, 255, 255)"`)

    return errors
  } finally {
    socket?.close()
    await browser?.close()
    await server.close()
  }
}

/**
 * Resolves once Vite sends an update, reload, or error after `action` completes.
 * Payloads still arriving from an earlier edit are ignored until the file
 * operation has finished, since the watcher reports it strictly later.
 */
function message(socket: WebSocket, action: () => Promise<unknown>) {
  return new Promise<string>((resolve, reject) => {
    let settled = false

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
        !settled ||
        (!text.includes('"type":"update"') &&
          !text.includes('"type":"full-reload"') &&
          !text.includes('"type":"error"'))
      )
        return

      cleanup()
      resolve(text)
    }

    socket.addEventListener('message', onMessage)
    action().then(
      () => {
        settled = true
      },
      (error: unknown) => {
        cleanup()
        reject(error)
      },
    )
  })
}

/** Server-renders the application and writes the hydration document. */
async function render(app: create.ReturnType, server: Vite.ViteDevServer) {
  const ssr = (await server.ssrLoadModule('/server.tsx')) as {
    render: () =>
      | { html: string; script: string }
      | Promise<{ html: string; script: string }>
  }

  const rendered = await ssr.render()

  await Fs.writeFile(
    Path.join(app.root, 'index.html'),
    `<!doctype html><html><head>${rendered.script}</head><body><div id="app">${rendered.html}</div><button id="dispose">Dispose</button><script type="module" src="/client.tsx"></script></body></html>`,
  )

  return rendered
}

/** Waits for dependency optimization so the first load does not reload the page. */
async function settle(
  server: Vite.ViteDevServer,
  page: Awaited<
    ReturnType<Awaited<ReturnType<typeof chromium.launch>>['newPage']>
  >,
) {
  const optimizer = server.environments.client.depsOptimizer

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
