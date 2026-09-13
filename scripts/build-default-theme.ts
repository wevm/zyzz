/** Emits the opt-in theme's runtime module and portable compiler contract after zile. @module */
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { Graph } from 'zyzz/compiler'

const root = Path.resolve(import.meta.dirname, '..')
const moduleId = 'zyzz/themes/default.js'
const source = await Fs.readFile(
  Path.join(root, 'src/themes/default.ts'),
  'utf8',
)
const result = Graph.compile({ modules: { [moduleId]: source } })
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
