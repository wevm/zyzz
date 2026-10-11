/**
 * Compares the WebAssembly fallback binding with the native addon over the repository's
 * authored modules. Every operation must return identical JSON, including failures.
 * Run `pnpm build:binding:test` and `pnpm build:binding:wasi` first.
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
// The local build writes one addon for the current platform.
const addon = Fs.readdirSync(Path.join(root, 'binding')).find((file) =>
  file.endsWith('.node'),
)

if (!addon) throw new Error('Build the native addon before this check.')

const native = require(Path.join(root, 'binding', addon)) as Binding
const wasi = require(Path.join(root, 'binding/wasi/zyzz.wasi.cjs')) as Binding

// Authored modules from the site and examples import the public entrypoints.
const modules: Record<string, string> = Object.create(null)

// Installed dependencies and build output stay out of the corpus.
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

const inputs: (readonly [string, string])[] = []

for (const [moduleId, source] of Object.entries(modules)) {
  inputs.push(['transform.compile', JSON.stringify({ moduleId, source })])
  inputs.push([
    'native.compile',
    JSON.stringify({ colorScheme: 'light', moduleId, source }),
  ])
}

inputs.push(['graph.compile', JSON.stringify({ modules })])

const failures: string[] = []

for (const [operation, input] of inputs)
  if (wasi.call(operation, input) !== native.call(operation, input))
    failures.push(`${operation} ${JSON.parse(input).moduleId ?? 'graph'}`)

// Incremental graphs keep their caches inside each binding's Graph instance.
const graphs = [new native.Graph(), new wasi.Graph()] as const
const snapshot = JSON.stringify({ modules })

for (let index = 0; index < 2; index++) {
  const [left, right] = graphs.map((graph) => graph.compile(snapshot))

  if (left !== right) failures.push(`Graph.compile ${index}`)
}

if (failures.length)
  throw new Error(
    `The WebAssembly binding differs from the native addon:\n${failures.join('\n')}`,
  )

console.log(
  `The WebAssembly binding matches the native addon on ${inputs.length + 2} operations over ${Object.keys(modules).length} modules.`,
)
