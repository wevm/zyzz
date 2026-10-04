/** Emits native entrypoints selected by React Native's package condition. @module */
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Module from 'node:module'
import * as Path from 'node:path'

const root = Path.resolve(import.meta.dirname, '..')
const require = Module.createRequire(import.meta.url)
const native = Module.createRequire(
  require.resolve('react-native/package.json'),
)
type Parser = {
  readonly TypeScriptParser: new () => { parseFile(path: string): unknown }
}
type Generator = {
  generate(name: string, schema: unknown): ReadonlyMap<string, string>
}
const parser = native(
  '@react-native/codegen/lib/parsers/typescript/parser.js',
) as Parser
const schema = new parser.TypeScriptParser().parseFile(
  Path.join(root, 'src/react-native/internal/NativeZyzz.ts'),
)
for (const module of [
  'GenerateModuleH',
  'GenerateModuleJniCpp',
  'GenerateModuleJniH',
]) {
  const generator = native(
    `@react-native/codegen/lib/generators/modules/${module}.js`,
  ) as Generator
  for (const [name, content] of generator.generate('ZyzzSpec', schema)) {
    if (name.endsWith('CMakeLists.txt')) continue
    const path = Path.join(root, 'native', name.replace('jni/', 'android/'))
    await Fs.writeFile(path, content.replace(/[\t ]+$/gm, ''))
  }
}

for (const file of [
  'react-native/index.native',
  'react-native/internal/Device',
  'react-native/internal/NativeZyzz',
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

// Device helpers preserve the portable React signatures. Keep the declaration
// entrypoint separate so Node's framework-free exports do not load React.
const declaration = Path.join(root, 'dist/react-native/index.native.d.ts')
await Fs.rm(declaration, { force: true })
await Fs.writeFile(
  declaration,
  `/** Native public exports and portable React contracts. @module */
export * as Host from './Host.js'
export * as StyleSheet from './StyleSheet.js'
export * as Variants from './Variants.js'
export { defineConfig, useStyles, useVars, withStyles } from './react.js'
`,
)

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
