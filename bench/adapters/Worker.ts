/** Measures real compiler and bundler lifecycles in an isolated process. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as ChildProcess from 'node:child_process'
import * as Zlib from 'node:zlib'
import { promisify } from 'node:util'
import { Graph } from 'zyzz/compiler'
import { Host } from 'zyzz/node'
import { zyzz } from 'zyzz/unplugin'
import * as Esbuild from 'esbuild'
import * as Rollup from 'rollup'
import Webpack from 'webpack'
import * as Vite from 'vite'
const { create, pack } = (await import(
  new URL('./Corpus.ts', import.meta.url).href
)) as typeof import('./Corpus.js')

const adapter = process.argv[2]!
const count = Number(process.env.ADAPTER_COMPONENTS ?? 96)
const root = await Fs.mkdtemp(Path.resolve('.fixture-adapter-workload-'))
const outDir = Path.join(root, 'dist')
const files = create(count)
const packed = await pack(root)
let close: (() => Promise<unknown>) | undefined
const timings: Record<string, number> = {}
let javascript = ''
try {
  for (const [name, source] of Object.entries(files))
    await Fs.writeFile(Path.join(root, name), source)
  const started = performance.now()
  const build = await setup()
  let css = await build()
  timings.cold = performance.now() - started
  check(css, ':red')
  check(css, 'outline-width:7px')
  async function run(name: string, edit?: [string, string], expected = ':red') {
    const start = performance.now()
    if (edit) {
      files[edit[0]] = edit[1]
      await Fs.writeFile(Path.join(root, edit[0] + '.tmp'), edit[1])
      await Fs.rename(
        Path.join(root, edit[0] + '.tmp'),
        Path.join(root, edit[0]),
      )
    }
    css = await build()
    timings[name] = performance.now() - start
    check(css, expected)
  }
  await run('unchanged')
  await run('style', [
    'component0.mjs',
    files['component0.mjs']!.replace('opacity:1', 'opacity:0.5'),
  ])
  check(css, 'opacity:0.5')
  await run(
    'token',
    ['tokens.mjs', files['tokens.mjs']!.replace("'red'", "'blue'")],
    ':blue',
  )
  await run(
    'addition',
    [
      'added.mjs',
      "import {style} from './config.mjs';export const added=style({zIndex:314})",
    ],
    ':blue',
  )
  // Entry linkage makes additions observable for entry-based bundlers as well as scanning hosts.
  await run(
    'link',
    ['entry.mjs', files['entry.mjs'] + ";export {added} from './added.mjs'"],
    ':blue',
  )
  check(css, 'z-index:314')
  const start = performance.now()
  delete files['added.mjs']
  files['entry.mjs'] = files['entry.mjs']!.replace(
    ";export {added} from './added.mjs'",
    '',
  )
  await Fs.writeFile(Path.join(root, 'entry.mjs'), files['entry.mjs'])
  await Fs.unlink(Path.join(root, 'added.mjs'))
  css = await build()
  timings.removal = performance.now() - start
  if (css.replaceAll(/\s/g, '').includes('z-index:314'))
    throw Error('Removed style survived')
  if (adapter !== 'api') {
    const paths = await Fs.readdir(outDir, { recursive: true })
    javascript = (
      await Promise.all(
        paths
          .filter((file) => /\.[cm]?[jt]sx?$/.test(file))
          .map((file) => Fs.readFile(Path.join(outDir, file), 'utf8')),
      )
    ).join('\n')
  }
  const size = (source: string) => ({
    raw: Buffer.byteLength(source),
    gzip: Zlib.gzipSync(source).byteLength,
    brotli: Zlib.brotliCompressSync(source).byteLength,
  })
  process.stdout.write(
    JSON.stringify({
      adapter,
      count,
      timings,
      sizes: { css: size(css), javascript: size(javascript) },
      rss: process.memoryUsage().rss,
    }),
  )
} finally {
  await close?.()
  await Fs.rm(root, { recursive: true, force: true })
}
function check(css: string, expected: string) {
  if (
    !css
      .replaceAll(/\s/g, '')
      .replaceAll('#00f', 'blue')
      .replaceAll(':.5', ':0.5')
      .includes(expected)
  )
    throw Error(`${adapter}: missing ${expected}`)
}
async function setup(): Promise<() => Promise<string>> {
  const input = Path.join(root, 'entry.mjs')
  const read = () => Fs.readFile(Path.join(outDir, 'zyzz.css'), 'utf8')
  if (adapter === 'api') {
    const compiler = Graph.create()
    return async () => {
      const imports = Object.fromEntries(
        Object.entries(files).map(([id, source]) => [
          id,
          Object.fromEntries(
            [...source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)].map(
              (match) => [
                match[1]!,
                match[1]!.startsWith('./') ? match[1]!.slice(2) : null,
              ],
            ),
          ),
        ]),
      )
      for (const links of Object.values(imports))
        if (Object.hasOwn(links, '@workload/library'))
          links['@workload/library'] = packed.id
      const result = compiler.compile({
        modules: files,
        imports,
        contracts: { [packed.id]: packed.contract },
      })
      javascript = Object.values(result.modules)
        .map((module) => module.code)
        .join('\n')
      return (
        result.sharedCss +
        Object.values(result.modules)
          .map((x) => x.css)
          .join('\n')
      )
    }
  }
  if (adapter === 'host') {
    const host = await Host.create({ root, outDir, packageId: 'workload' })
    close = () => host.close()
    return async () => {
      await host.build()
      return read()
    }
  }
  if (adapter === 'cli')
    return async () => {
      await promisify(ChildProcess.execFile)(
        process.execPath,
        ['dist/cli/index.js', 'build', root, '--out-dir', outDir],
        { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 },
      )
      return read()
    }
  if (adapter === 'esbuild') {
    const context = await Esbuild.context({
      bundle: true,
      entryPoints: [input],
      format: 'esm',
      logLevel: 'silent',
      outdir: outDir,
      plugins: [zyzz.esbuild({ root })],
    })
    close = () => context.dispose()
    return async () => {
      await context.rebuild()
      return read()
    }
  }
  if (adapter === 'rollup') {
    const plugin = zyzz.rollup({ root })
    let cache: Rollup.RollupCache | undefined
    return async () => {
      const bundle = await Rollup.rollup({
        input,
        cache,
        external: ['zyzz/runtime'],
        plugins: [
          {
            name: 'workload-package',
            resolveId(id) {
              if (id === '@workload/library') return packed.id
            },
          },
          plugin,
        ],
        onwarn(warning, warn) {
          if (warning.code !== 'UNRESOLVED_IMPORT') warn(warning)
        },
      })
      try {
        cache = bundle.cache
        await bundle.write({ dir: outDir, format: 'esm' })
        return await read()
      } finally {
        await bundle.close()
      }
    }
  }
  if (adapter === 'webpack') {
    const compiler = Webpack({
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
            ? reject(error ?? Error(stats?.toString()))
            : resolve(),
        ),
      )
      return read()
    }
  }
  if (adapter === 'vite')
    return async () => {
      await Vite.build({
        configFile: false,
        root,
        logLevel: 'silent',
        plugins: [zyzz.vite()],
        build: {
          lib: { entry: input, formats: ['es'], fileName: 'app' },
          outDir,
          emptyOutDir: true,
          minify: false,
        },
      })
      return (
        await Promise.all(
          (
            await Fs.readdir(outDir)
          )
            .filter((x) => x.endsWith('.css'))
            .map((x) => Fs.readFile(Path.join(outDir, x), 'utf8')),
        )
      ).join('\n')
    }
  throw Error(`Unknown adapter ${adapter}`)
}
