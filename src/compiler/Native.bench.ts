/** Measures native compilation of dynamic and responsive source and packed styles. @module */
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Packed from '../../test/fixtures/Packed.js'
import * as Vm from 'node:vm'
import * as Zlib from 'node:zlib'
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

const responsive = {
  'Styles.ts': await Fs.readFile(
    'test/fixtures/native/responsive/Styles.ts',
    'utf8',
  ),
}
const responsivePublisher = Graph.compile({ modules: responsive })

describe('native responsive / breakpoint and height queries', () => {
  bench(
    'source graph',
    () => {
      Graph.compile({ modules: responsive, native })
    },
    { time: 1000, warmupTime: 500 },
  )
  bench(
    'packed consumer',
    () => {
      Graph.compile({
        contracts: {
          'components/index.js': responsivePublisher.contracts['Styles.ts']!,
        },
        imports: { 'app.ts': { components: 'components/index.js' } },
        modules: { 'app.ts': "export * from 'components';" },
        native,
      })
    },
    { time: 1000, warmupTime: 500 },
  )
})

const recipe = {
  'Recipe.ts': `import {variants} from 'zyzz';
export const card=variants({
  base:{opacity:0.8},
  variants:{
    size:{small:{width:'20px'},medium:{width:'40px'},large:{width:'60px'}},
    spacing:{small:{padding:'2px'},medium:{padding:'4px'},large:{padding:'8px'}},
    tone:{quiet:{opacity:0.3},normal:{opacity:0.6},loud:{opacity:1}},
    weight:{normal:{fontWeight:400},medium:{fontWeight:500},bold:{fontWeight:700}}
  },
  defaultVariants:{size:'small',spacing:'small',tone:'normal',weight:'normal'},
  compoundVariants:[{when:{size:'large',tone:'loud'},style:{borderWidth:'2px'}}]
});`,
}
const recipePublisher = Graph.compile({ modules: recipe })
const selection = {
  size: 'large',
  spacing: 'large',
  tone: 'loud',
  weight: 'bold',
} as const

for (const kind of ['source', 'packed'] as const) {
  const options: Graph.compile.Options =
    kind === 'source'
      ? { modules: recipe, native: { colorScheme: 'light', platform: 'ios' } }
      : {
          contracts: {
            'components/index.js': recipePublisher.contracts['Recipe.ts']!,
          },
          imports: { 'app.ts': { components: 'components/index.js' } },
          modules: { 'app.ts': "export {card} from 'components';" },
          native: { colorScheme: 'light', platform: 'ios' },
        }
  const output = Graph.compile(options)
  const code = await Packed.bundle({
    entry: kind === 'source' ? 'Recipe.ts' : 'app.ts',
    modules: Object.fromEntries(
      Object.entries(output.modules).map((entry) => [entry[0], entry[1].code]),
    ),
    packages: {
      components: { 'index.js': recipePublisher.modules['Recipe.ts']!.code },
    },
  })
  type Callable = (values: typeof selection) => { readonly style: unknown }
  const create = () => Vm.runInNewContext(`${code}; Fixture.card`) as Callable
  const card = create()
  const expected = {
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderTopWidth: 2,
    fontWeight: 700,
    opacity: 1,
    paddingBottom: 8,
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 8,
    width: 60,
  }
  const actual = card(selection).style as Record<string, unknown>
  if (
    Object.keys(actual).length !== Object.keys(expected).length ||
    Object.entries(expected).some((entry) => actual[entry[0]] !== entry[1])
  )
    throw new Error(
      `Native ${kind} recipe benchmark changed its selected style: ${JSON.stringify(actual)}.`,
    )
  const javascript = (await Esbuild.transform(code, { minify: true })).code
  await Fs.mkdir('bench/results/native-programs', { recursive: true })
  await Fs.writeFile(
    `bench/results/native-programs/${kind}.json`,
    JSON.stringify(
      {
        gzip: Zlib.gzipSync(javascript).byteLength,
        javascript: Buffer.byteLength(javascript),
        kind,
        selections: 256,
      },
      null,
      2,
    ),
  )

  describe(`native finite recipe / ${kind} / 256 selections`, () => {
    bench(
      'compile',
      () => {
        Graph.compile(options)
      },
      { time: 1000, warmupTime: 500 },
    )
    bench(
      'cold module and first selection',
      () => {
        create()(selection)
      },
      { time: 1000, warmupTime: 500 },
    )
    bench(
      'warm selection',
      () => {
        card(selection)
      },
      { time: 1000, warmupTime: 500 },
    )
  })
}
