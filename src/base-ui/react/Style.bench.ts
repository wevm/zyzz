/** Measures complete compilation of the real Base UI Select fixture. @module */
import * as Fs from 'node:fs'
import * as Path from 'node:path'
import { bench, describe } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'

const directory = Path.resolve(
  import.meta.dirname,
  '../../../test/fixtures/base-ui',
)
const modules = Object.fromEntries(
  ['Config.ts', 'Select.tsx'].map((file) => [
    file,
    Fs.readFileSync(Path.join(directory, file), 'utf8'),
  ]),
)

describe('Base UI Select graph', () => {
  bench('extract + emit + rewrite + maps', () => {
    Graph.compile({ modules })
  })
})
