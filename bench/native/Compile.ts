/** Runs each native Babel pipeline with the same Expo preset and caller. @module */
import * as Babel from '@babel/core'
import * as Module from 'node:module'
import * as Path from 'node:path'
import { zyzz } from '../../src/babel/index.js'
import * as Corpus from './Corpus.js'

const require = Module.createRequire(
  Path.resolve('bench/native/app/package.json'),
)
const expoRequire = Module.createRequire(require.resolve('expo/package.json'))
const preset = expoRequire.resolve('babel-preset-expo')

/** Includes authoring transforms, TypeScript/JSX lowering, and source map generation. */
export function compile(
  library: Corpus.Library,
  workload: Corpus.Case,
  platform: 'ios' | 'android',
  edited = false,
  source = Corpus.source(library, workload, edited),
) {
  const filename = Path.resolve(
    `bench/native/app/generated/${library}/Fixture.tsx`,
  )
  const plugins: Babel.PluginItem[] =
    library === 'zyzz'
      ? [
          [
            zyzz,
            {
              platform,
              units: { px: 1 },
              moduleId: 'Fixture.tsx',
              modules: { 'Fixture.tsx': source },
            },
          ],
        ]
      : library === 'unistyles'
        ? [
            [
              require.resolve('react-native-unistyles/plugin'),
              { root: Path.relative(process.cwd(), Path.dirname(filename)) },
            ],
          ]
        : []
  const caller = {
    name: 'metro',
    platform,
    isDev: false,
    supportsStaticESM: true,
  }
  return Babel.transformSync(source, {
    babelrc: false,
    configFile: false,
    filename,
    caller,
    plugins,
    presets: [[preset, { enableBabelRuntime: false }]],
    sourceMaps: true,
  })!
}
