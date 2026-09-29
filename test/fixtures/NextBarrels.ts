/** Verifies named barrel dependency boundaries through the real Next Webpack loader. @module */
import * as Fs from 'node:fs/promises'
import * as Module from 'node:module'
import * as Path from 'node:path'
import webpack from 'webpack'

const require = Module.createRequire(import.meta.url)
const root = await Fs.mkdtemp(Path.resolve('.fixture-next-barrels-'))
const compiler = webpack({
  cache: false,
  context: root,
  devtool: false,
  entry: './consumer.mjs',
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
  const files = {
    'barrel.mjs':
      "export { Component as Renamed } from './component.mjs';export { unused } from './unrelated.mjs';",
    'component.mjs':
      "import {style} from 'zyzz';const card=style({color:'red'});export function Component(){return card()}",
    'consumer.mjs':
      "import {style} from 'zyzz';import {Renamed} from './forward.mjs';export const own=style({display:'flex'});export const rendered=Renamed();",
    'forward.mjs': "export {Renamed} from './barrel.mjs';",
    'unrelated.mjs':
      "import {style} from 'zyzz';export const unused=style({color:'orange'});",
  }
  for (const [file, source] of Object.entries(files))
    await Fs.writeFile(Path.join(root, file), source)
  const cold = await build()
  await Fs.writeFile(
    Path.join(root, 'component.mjs'),
    files['component.mjs'].replace("color:'red'", "color:'blue'"),
  )
  const edited = await build()
  // A forwarded style reference must return to the compile-time graph after an export changes kind.
  await Fs.writeFile(
    Path.join(root, 'component.mjs'),
    "import {style} from 'zyzz';export const Component=style({color:'green'});",
  )
  const reference = await build()
  process.stdout.write(JSON.stringify({ cold, edited, reference }))
} finally {
  await new Promise<void>((resolve, reject) =>
    compiler.close((error) => (error ? reject(error) : resolve())),
  )
  await Fs.rm(root, { force: true, recursive: true })
}

async function build() {
  const stats = await new Promise<webpack.Stats>((resolve, reject) =>
    compiler.run((error, stats) => {
      if (error) reject(error)
      else if (!stats || stats.hasErrors())
        reject(
          new Error(
            stats?.toString({ all: false, errors: true }) ??
              'Missing Webpack stats.',
          ),
        )
      else resolve(stats)
    }),
  )
  const consumer = [...stats.compilation.modules].find(
    (module) =>
      module instanceof webpack.NormalModule &&
      module.resource === Path.join(root, 'consumer.mjs'),
  )!
  if (!consumer?.buildInfo)
    throw new Error('Missing consumer build information.')

  const dependencies = [
    ...(consumer.buildInfo.snapshot?.getFileIterable() ??
      consumer.buildInfo.fileDependencies ??
      []),
  ]
    .filter((file) => file.startsWith(root) && file.endsWith('.mjs'))
    .map((file) => Path.relative(root, file))
    .sort()
  const code = await Fs.readFile(Path.join(root, 'dist/main.js'), 'utf8')
  return {
    blue: code.includes('color:blue'),
    dependencies,
    green: code.includes('color:green'),
    red: code.includes('color:red'),
  }
}
