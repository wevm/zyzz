/** Emits the opt-in theme's runtime module and portable compiler contract after zile. @module */
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Url from 'node:url'
import type * as Graph from '../src/compiler/Graph.js'

const root = Path.resolve(import.meta.dirname, '..')
const moduleId = 'zyzz/themes/default.js'
const source = await Fs.readFile(
  Path.join(root, 'src/themes/default.ts'),
  'utf8',
)
const result = await (async () => {
  const temporary = await Fs.mkdtemp(
    Path.join(root, '.fixture-theme-compiler-'),
  )
  try {
    await Esbuild.build({
      bundle: true,
      entryPoints: [Path.join(root, 'src/compiler/Graph.ts')],
      format: 'esm',
      outdir: temporary,
      packages: 'external',
      platform: 'node',
    })
    const compiler = (await import(
      Url.pathToFileURL(Path.join(temporary, 'Graph.js')).href
    )) as typeof Graph
    return compiler.compile({ modules: { [moduleId]: source } })
  } finally {
    await Fs.rm(temporary, { recursive: true, force: true })
  }
})()
const output = result.modules[moduleId]!
const mapped = `${output.code}\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(JSON.stringify(output.map)).toString('base64')}`
const transformed = await Esbuild.transform(mapped, {
  format: 'esm',
  loader: 'ts',
  sourcefile: 'default.ts',
  sourcemap: 'external',
  target: 'esnext',
})
const directory = Path.join(root, 'dist/themes')
await Fs.mkdir(directory, { recursive: true })
// Development linking creates a source symlink; replace it without writing through it.
await Fs.rm(Path.join(directory, 'default.js'), { force: true })
await Fs.writeFile(
  Path.join(directory, 'default.js'),
  `${transformed.code}\n//# sourceMappingURL=default.js.map\n`,
)
await Fs.writeFile(Path.join(directory, 'default.js.map'), transformed.map)
await Fs.writeFile(
  Path.join(directory, 'default.js.zyzz.json'),
  result.contracts[moduleId]!,
)
await Fs.copyFile(
  Path.join(root, 'src/themes/LICENSE.tailwind'),
  Path.join(directory, 'LICENSE.tailwind'),
)
