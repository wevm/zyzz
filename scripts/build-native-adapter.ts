/** Emits native entrypoints selected by React Native's package condition. @module */
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'

const root = Path.resolve(import.meta.dirname, '..')
for (const file of [
  'react-native/index.native',
  'react-native/internal/Device',
]) {
  const output = Path.join(root, 'dist', `${file}.js`)
  const sourcePath = Path.join(root, 'src', `${file}.ts`)
  const source = await Fs.readFile(sourcePath, 'utf8')
  const result = await Esbuild.transform(source, {
    format: 'esm',
    loader: 'ts',
    sourcefile: Path.relative(Path.dirname(output), sourcePath),
    sourcemap: 'external',
    target: 'esnext',
  })
  await Fs.mkdir(Path.dirname(output), { recursive: true })
  await Fs.rm(output, { force: true })
  await Fs.writeFile(
    output,
    `${result.code}\n//# sourceMappingURL=${Path.basename(output)}.map\n`,
  )
  await Fs.writeFile(`${output}.map`, result.map)
}

const path = Path.join(root, 'package.json')
type Package = { exports: Record<string, Record<string, unknown>> }
const pkg = JSON.parse(await Fs.readFile(path, 'utf8')) as Package
// Native device selection precedes the portable source condition in Metro.
for (const key of ['./react-native', './react-native/react']) {
  const entry = pkg.exports[key]
  if (!entry?.['react-native'])
    throw new Error(`Missing native package condition: ${key}.`)
  pkg.exports[key] = { 'react-native': entry['react-native'], ...entry }
}
await Fs.writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`)
