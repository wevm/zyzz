/** Observes source reuse through real adapter builds without timing assertions or compiler replacements. @module */
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Inspector from 'node:inspector/promises'
import * as Module from 'node:module'
const Watch = (await import(
  new URL('./Watch.ts', import.meta.url).href
)) as typeof import('./Watch.js')
import * as Path from 'node:path'
import * as Rollup from 'rollup'
import * as Url from 'node:url'
import * as Vite from 'vite'
import Webpack from 'webpack'
import { create as metro } from 'zyzz/metro/transformer'
import { Host } from 'zyzz/node'
import { zyzz } from 'zyzz/unplugin'

const adapter = process.argv[2]!
const require = Module.createRequire(import.meta.url)
const root = await Fs.mkdtemp(Path.resolve('.fixture-adapter-cache-'))
const session = new Inspector.Session()
session.connect()
const observed = new Set<string>()
let editedFile: (() => Promise<void>) | undefined
let close: (() => Promise<unknown>) | undefined

try {
  await Fs.writeFile(Path.join(root, 'config.mjs'), config('red'))
  await Fs.writeFile(
    Path.join(root, 'button.mjs'),
    "import {style} from './config.mjs';export const button=style({color:'brand'});",
  )
  await Fs.writeFile(
    Path.join(root, 'unrelated.mjs'),
    "import {style} from 'zyzz';export const unrelated=style({opacity:0.5});",
  )
  const build = await setup()
  await session.post('Profiler.enable')
  await session.post('Profiler.startPreciseCoverage', {
    callCount: true,
    detailed: true,
  })
  async function run() {
    const code = await build()
    const { result } = await session.post('Profiler.takePreciseCoverage')
    const calls = (file: string, name: string) => {
      const script = result.find(
        (script) =>
          script.url === Url.pathToFileURL(require.resolve(file)).href,
      )
      const fn = script?.functions.find((fn) => fn.functionName === name)
      const key = `${file}:${name}`
      if (fn) observed.add(key)
      if (!observed.has(key)) throw new Error(`Missing V8 coverage for ${key}`)
      return fn?.ranges[0]?.count ?? 0
    }
    return {
      code,
      parses: calls('oxc-parser', 'parseSync'),
      extractions: calls('../../dist/compiler/Source.js', 'extract'),
    }
  }
  const cold = await run()
  const warm = await run()
  const updated = editedFile?.()
  await Fs.writeFile(Path.join(root, 'config.mjs.tmp'), config('blue'))
  await Fs.rename(
    Path.join(root, 'config.mjs.tmp'),
    Path.join(root, 'config.mjs'),
  )
  await updated
  const edited = await run()
  const settled = await run()
  process.stdout.write(JSON.stringify({ cold, edited, settled, warm }))
} finally {
  session.disconnect()
  await close?.()
  await Fs.rm(root, { recursive: true, force: true })
}

async function setup(): Promise<() => Promise<string>> {
  const input = Path.join(root, 'button.mjs')
  const outDir = Path.join(root, 'dist')
  if (adapter === 'host') {
    const host = await Host.create({ root, outDir, packageId: 'app' })
    close = () => host.close()
    return async () => {
      await host.build()
      return Fs.readFile(Path.join(outDir, 'zyzz.css'), 'utf8')
    }
  }
  if (adapter === 'esbuild') {
    const context = await Esbuild.context({
      bundle: true,
      entryPoints: [input],
      logLevel: 'silent',
      outdir: outDir,
      plugins: [zyzz.esbuild({ root })],
    })
    close = () => context.dispose()
    return async () => {
      await context.rebuild()
      return Fs.readFile(Path.join(outDir, 'zyzz.css'), 'utf8')
    }
  }
  if (adapter === 'rollup') {
    const plugin = zyzz.rollup({ root })
    return async () => {
      const bundle = await Rollup.rollup({
        external: ['zyzz/runtime'],
        input,
        plugins: [plugin],
      })
      try {
        await bundle.write({ dir: outDir })
        return await Fs.readFile(Path.join(outDir, 'zyzz.css'), 'utf8')
      } finally {
        await bundle.close()
      }
    }
  }
  if (adapter === 'webpack') {
    const compiler = Webpack({
      cache: false,
      context: root,
      entry: input,
      mode: 'development',
      output: { path: outDir },
      plugins: [zyzz.webpack({ root })],
    })
    close = () =>
      new Promise<void>((resolve, reject) =>
        compiler.close((error) => (error ? reject(error) : resolve())),
      )
    return async () => {
      await new Promise<void>((resolve, reject) =>
        compiler.run((error, stats) =>
          error || stats?.hasErrors()
            ? reject(error ?? new Error(stats?.toString()))
            : resolve(),
        ),
      )
      return Fs.readFile(Path.join(outDir, 'zyzz.css'), 'utf8')
    }
  }
  if (adapter === 'vite') {
    let updated: (() => void) | undefined
    const server = await Vite.createServer({
      configFile: false,
      logLevel: 'silent',
      optimizeDeps: { noDiscovery: true },
      plugins: [
        zyzz.vite(),
        {
          name: 'cache-fixture',
          hotUpdate({ file }) {
            if (
              this.environment.name === 'client' &&
              file === Path.join(root, 'config.mjs')
            )
              updated?.()
          },
        },
      ],
      root,
      server: { host: '127.0.0.1', port: 0 },
    })
    await server.listen()
    const watching = performance.now()
    while (!server.watcher.getWatched()[root]?.includes('config.mjs')) {
      if (performance.now() - watching > 5000)
        throw new Error('Fixture watcher did not register config.mjs')
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    const changes = Watch.create({ path: 'config.mjs', timeoutMs: 10000 })
    updated = () =>
      changes.onResult({
        result: { changed: ['config.mjs'], files: ['config.mjs'] },
      })
    editedFile = () => changes.next()
    close = () => server.close()
    return async () => {
      server.environments.client!.moduleGraph.invalidateAll()
      const button = await server.transformRequest('/button.mjs')
      await server.transformRequest('/config.mjs')
      await server.transformRequest('/unrelated.mjs')
      const shared = await server.transformRequest('\0zyzz:shared.css')
      return button!.code + shared!.code
    }
  }
  if (adapter === 'metro') {
    const expo = Module.createRequire(
      Path.resolve('examples/react-native/package.json'),
    )
    const transformer = metro(
      Module.createRequire(expo.resolve('expo/metro-config')).resolve(
        '@expo/metro-config/babel-transformer',
      ),
      { root },
    )
    return async () => {
      const inputOptions = {
        dev: true,
        enableBabelRCLookup: false,
        hot: false,
        inlineRequires: false,
        minify: false,
        platform: 'ios',
        projectRoot: root,
        type: 'module',
      }
      const result = await transformer.transform({
        filename: input,
        options: inputOptions,
        src: await Fs.readFile(input, 'utf8'),
      })
      return JSON.stringify(result)
    }
  }
  throw new Error(`Unknown adapter: ${adapter}`)
}

function config(color: string) {
  return `import {Config} from 'zyzz';export const {style}=Config.create({vars:{color:{brand:'${color}'}}});`
}
