/** Builds the separately loaded source compiler and local preview runtime. @module */
import * as ChildProcess from 'node:child_process'
import * as Crypto from 'node:crypto'
import * as Fs from 'node:fs/promises'
import * as Module from 'node:module'
import * as Path from 'node:path'
import * as Esbuild from 'esbuild'

const root = Path.resolve(import.meta.dirname, '../..')
const require = Module.createRequire(import.meta.url)

// A separate target directory keeps this build from replacing the lightweight CSS artifact.
ChildProcess.execFileSync(
  'cargo',
  [
    'build',
    '-p',
    'wasm',
    '--features',
    'compiler',
    '--profile',
    'wasm',
    '--target',
    'wasm32-wasip1',
    '--target-dir',
    'target/playground',
  ],
  { cwd: root, stdio: 'inherit' },
)

const bytes = await Fs.readFile(
  Path.join(root, 'target/playground/wasm32-wasip1/wasm/wasm.wasm'),
)
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

await Fs.mkdir(Path.join(root, 'site/src/playground'), { recursive: true })
await Fs.writeFile(
  Path.join(root, 'site/src/playground/assets.generated.json'),
  JSON.stringify({ dependencies, files }),
)
await Fs.writeFile(
  Path.join(root, 'site/src/playground/compiler.generated.json'),
  JSON.stringify({ wasm: `/playground/${name}` }),
)
console.log(
  `Playground compiler: ${(bytes.length / 1024 / 1024).toFixed(2)} MiB (uncompressed)`,
)
