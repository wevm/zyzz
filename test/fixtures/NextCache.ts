/** Measures compiler work during real Next loader requests in an isolated Webpack process. @module */
import * as Fs from 'node:fs/promises'
import * as Inspector from 'node:inspector/promises'
import * as Module from 'node:module'
import * as Path from 'node:path'
import * as Url from 'node:url'
import webpack from 'webpack'

const require = Module.createRequire(import.meta.url)
const root = await Fs.mkdtemp(Path.resolve('.fixture-next-cache-'))
const session = new Inspector.Session()
session.connect()
const observed = new Set<string>()

const compiler = webpack({
  // Force loader requests on every build so Webpack cannot hide missing Zyzz cache reuse.
  cache: false,
  context: root,
  devtool: false,
  entry: ['./config.mjs', './button.mjs', './unrelated.mjs'],
  mode: 'development',
  module: {
    rules: [
      {
        include: root,
        test: /\.mjs$/,
        use: [
          {
            loader: require.resolve('zyzz/next/loader'),
            options: { bundler: 'webpack', root },
          },
        ],
      },
      { sideEffects: true, test: /\.css$/, type: 'asset/source' },
    ],
  },
  output: { path: Path.join(root, 'dist') },
})

try {
  await Fs.writeFile(Path.join(root, 'config.mjs'), config('red'))
  await Fs.writeFile(
    Path.join(root, 'button.mjs'),
    "import {style} from './config.mjs';export const button=style({color:'brand'});",
  )
  await Fs.writeFile(
    Path.join(root, 'unrelated.mjs'),
    "import {style} from 'zyzz';export const unrelated=style({display:'flex'});",
  )
  await session.post('Profiler.enable')
  await session.post('Profiler.startPreciseCoverage', {
    callCount: true,
    detailed: true,
  })

  const cold = await build()
  const warm = await build()
  await Fs.writeFile(Path.join(root, 'config.mjs'), config('blue'))
  const edited = await build()
  const settled = await build()
  process.stdout.write(JSON.stringify({ cold, edited, settled, warm }))
} finally {
  await session.post('Profiler.stopPreciseCoverage')
  session.disconnect()
  await new Promise<void>((resolve, reject) =>
    compiler.close((error) => (error ? reject(error) : resolve())),
  )
  await Fs.rm(root, { force: true, recursive: true })
}

async function build() {
  await new Promise<void>((resolve, reject) =>
    compiler.run((error, stats) => {
      if (error) reject(error)
      else if (!stats || stats.hasErrors())
        reject(
          new Error(
            stats?.toString({ all: false, errors: true }) ??
              'Missing Webpack stats.',
          ),
        )
      else resolve()
    }),
  )
  const { result } = await session.post('Profiler.takePreciseCoverage')
  const calls = (file: string, name: string) => {
    const script = result.find(
      (script) => script.url === Url.pathToFileURL(require.resolve(file)).href,
    )
    const fn = script?.functions.find((fn) => fn.functionName === name)
    const key = `${file}:${name}`
    // V8 omits functions with no calls since the previous coverage collection.
    if (fn) observed.add(key)
    if (!observed.has(key)) throw new Error(`Missing V8 coverage for ${key}`)
    return fn?.ranges[0]?.count ?? 0
  }
  return {
    code: await Fs.readFile(Path.join(root, 'dist/main.js'), 'utf8'),
    extractions: calls('../../dist/compiler/Source.js', 'extract'),
    loads: calls('zyzz/next/loader', 'loader'),
    parses: calls('../../dist/compiler/internal/Syntax.js', 'parse'),
    transforms: calls('../../dist/compiler/Transform.js', 'compile'),
  }
}

function config(color: string) {
  return `import {Config} from 'zyzz';export const {style}=Config.create({vars:{color:{brand:'${color}'}}});`
}
