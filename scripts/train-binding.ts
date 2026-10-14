/**
 * Trains the instrumented native addon for `scripts/build-binding.ts`. Every authored module of
 * the examples, site, and test fixtures passes through each compiler operation a host calls, and
 * the addon writes its profile when this process exits.
 * @module
 */
import * as Fs from 'node:fs'
import * as Module from 'node:module'
import * as Path from 'node:path'

type Binding = {
  readonly call: (operation: string, input: string) => string
  readonly Graph: new () => { readonly compile: (input: string) => string }
}

const root = Path.resolve(import.meta.dirname, '..')
const require = Module.createRequire(import.meta.url)
// `binding/` can hold addons for other platforms, so the build names the one it instrumented.
const addon = process.argv[2]

if (!addon || !Fs.existsSync(addon))
  throw new Error('Pass the instrumented addon path to train it.')

const binding = require(addon) as Binding
const modules: Record<string, string> = Object.create(null)

// Installed dependencies, build output, tests, and benchmarks stay out of the corpus.
function collect(directory: string): void {
  for (const entry of Fs.readdirSync(Path.join(root, directory), {
    withFileTypes: true,
  })) {
    const path = `${directory}/${entry.name}`

    if (entry.isDirectory()) {
      if (!/^(\.|dist$|node_modules$)/.test(entry.name)) collect(path)
      continue
    }

    if (!/\.tsx?$/.test(entry.name) || /\.(test|bench)/.test(entry.name))
      continue

    const source = Fs.readFileSync(Path.join(root, path), 'utf8')

    if (source.includes("from 'zyzz")) modules[path] = source
  }
}

collect('examples')
collect('site/src')
collect('test/fixtures')

// Hosts pass the source after a NUL, with the options a bundler plugin chooses.
const variants = [
  {},
  { composition: 'independent' },
  { cssOutput: 'grouped', development: true },
] as const

for (const [moduleId, source] of Object.entries(modules)) {
  for (const options of variants)
    binding.call(
      'transform.compile',
      `${JSON.stringify({ ...options, moduleId })}\0${source}`,
    )

  binding.call(
    'native.compile',
    JSON.stringify({ colorScheme: 'light', moduleId, source }),
  )
  binding.call('source.extract', JSON.stringify({ moduleId, source }))
}

// An incremental graph compiles the corpus once cold and once from its caches.
const graph = new binding.Graph()
const snapshot = JSON.stringify({ modules })

graph.compile(snapshot)
graph.compile(snapshot)

console.log(`Trained the addon on ${Object.keys(modules).length} modules.`)
