/** Measures native compilation of the Tempro dynamic-style migration fixture. @module */
import * as Fs from 'node:fs/promises'
import { bench, describe } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'

const modules = {
  'Dimensions.ts': await Fs.readFile(
    'test/fixtures/native/tempro/Dimensions.ts',
    'utf8',
  ),
  'Styles.ts': await Fs.readFile(
    'test/fixtures/native/tempro/Styles.ts',
    'utf8',
  ),
}
const publisher = Graph.compile({ modules })
const native = {
  colorScheme: 'light',
  contextual: true,
  platform: 'ios',
} as const
const packed = {
  contracts: { 'components/index.js': publisher.contracts['Styles.ts']! },
  imports: { 'app.ts': { components: 'components/index.js' } },
  modules: { 'app.ts': "export * from 'components';" },
  native,
}

describe('native Tempro / six dynamic geometries', () => {
  bench(
    'source graph',
    () => {
      Graph.compile({ modules, native })
    },
    {
      time: 1000,
      warmupTime: 500,
    },
  )
  bench(
    'packed consumer',
    () => {
      Graph.compile(packed)
    },
    {
      time: 1000,
      warmupTime: 500,
    },
  )
})
