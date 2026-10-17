/** Copies the separately loaded source compiler and builds the local preview runtime. @module */
import * as ChildProcess from 'node:child_process'
import * as Crypto from 'node:crypto'
import * as Fs from 'node:fs/promises'
import * as Module from 'node:module'
import * as Path from 'node:path'
import * as Esbuild from 'esbuild'

const root = Path.resolve(import.meta.dirname, '../..')
const require = Module.createRequire(import.meta.url)

// The package build writes `binding/compiler.wasm`, which `zyzz/compiler.wasm` publishes.
ChildProcess.execFileSync('node', ['scripts/build-wasm.ts'], {
  cwd: root,
  stdio: 'inherit',
})

const bytes = await Fs.readFile(Path.join(root, 'binding/compiler.wasm'))
const name = `compiler-${Crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16)}.wasm`
const directory = Path.join(root, 'site/public/playground')
await Fs.mkdir(directory, { recursive: true })
await Fs.writeFile(Path.join(directory, name), bytes)

const files: Record<string, { code: string }> = {}
for (const entry of ['index', 'runtime/index']) {
  const result = await Esbuild.build({
    bundle: true,
    entryPoints: [Path.join(root, `src/${entry}.ts`)],
    format: 'esm',
    minify: true,
    platform: 'browser',
    // The browser Parcel preview uses a parser that predates optional chaining.
    target: 'es2018',
    supported: { bigint: true },
    write: false,
  })
  files[`/node_modules/zyzz/${entry}.js`] = {
    code: result.outputFiles[0]!.text,
  }
}
files['/node_modules/zyzz/package.json'] = {
  code: JSON.stringify({ main: 'index.js', name: 'zyzz', version: '0.0.0' }),
}

const dependencies: Record<string, string> = {}
for (const name of ['react', 'react-dom']) {
  const manifest = JSON.parse(
    await Fs.readFile(require.resolve(`${name}/package.json`), 'utf8'),
  )
  dependencies[name] = manifest.version
}

const runtime = JSON.stringify({ dependencies, files })
const runtimeName = `runtime-${Crypto.createHash('sha256').update(runtime).digest('hex').slice(0, 16)}.json`
await Fs.writeFile(Path.join(directory, runtimeName), runtime)
await Fs.writeFile(
  Path.join(directory, 'manifest.json'),
  JSON.stringify({
    wasm: `/playground/${name}`,
    runtime: `/playground/${runtimeName}`,
  }),
)
console.log(
  `Playground compiler: ${(bytes.length / 1024 / 1024).toFixed(2)} MiB (uncompressed)`,
)
