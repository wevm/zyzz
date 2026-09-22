/** Exercises repeated Next loader compilation in a real Webpack consumer. @module */
import * as Fs from 'node:fs/promises'
import * as Module from 'node:module'
import * as Path from 'node:path'
import webpack from 'webpack'

const require = Module.createRequire(import.meta.url)
const root = await Fs.mkdtemp(Path.resolve('.fixture-next-cache-'))

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
  const cold = await build()
  const warm = await build()
  await Fs.writeFile(Path.join(root, 'config.mjs'), config('blue'))
  const edited = await build()
  const settled = await build()
  process.stdout.write(JSON.stringify({ cold, edited, settled, warm }))
} finally {
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
  return await Fs.readFile(Path.join(root, 'dist/main.js'), 'utf8')
}

function config(color: string) {
  return `import {Config} from 'zyzz';export const {style}=Config.create({vars:{color:{brand:'${color}'}}});`
}
