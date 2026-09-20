import { Vars } from 'zyzz'
/** Measures bounded native recipe compilation through source extraction and themed tables. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { bench, describe } from 'vite-plus/test'
import { Style } from 'zyzz'
import { Source } from 'zyzz/compiler'
import { Variants } from 'zyzz/react-native'

const base = Vars.define({ color: { ink: { dark: '#fff', light: '#000' } } })
const alternate = Vars.extend(base, {
  color: { ink: { dark: '#ddd', light: '#222' } },
})
const axes = {
  size: {
    small: { fontSize: '12px' },
    medium: { fontSize: '16px' },
    large: { fontSize: '20px' },
  },
  tone: {
    quiet: { opacity: 0.3 },
    normal: { opacity: 0.6 },
    loud: { opacity: 1 },
  },
  weight: {
    normal: { fontWeight: 400 },
    medium: { fontWeight: 500 },
    bold: { fontWeight: 700 },
  },
  spacing: {
    small: { padding: '2px' },
    medium: { padding: '4px' },
    large: { padding: '8px' },
  },
}

for (const [label, variants] of [
  [
    '9 selections',
    {
      size: { small: axes.size.small, large: axes.size.large },
      tone: { quiet: axes.tone.quiet, loud: axes.tone.loud },
    },
  ],
  ['256 selections', axes],
  ['512 selections rejected', { ...axes, active: { true: { opacity: 0.5 } } }],
] as const) {
  const recipe = Source.extract({
    moduleId: 'native-card.ts',
    source: `import { variants } from 'zyzz'; export const card = variants(${JSON.stringify(
      {
        base: {
          fontSize: '10px',
          lineHeight: 1.5,
          targets: { native: { borderRadius: 4 }, ios: { opacity: 0.9 } },
        },
        variants,
        defaultVariants: { size: 'small', tone: 'quiet' },
        compoundVariants: [
          {
            when: { size: 'large', tone: 'loud' },
            style: { targets: { native: { transform: [{ scale: 1.1 }] } } },
          },
        ],
      },
    )});`,
  }).calls[0]!.staticRecipe!
  const options = {
    platform: 'ios',
    recipe: {
      ...recipe,
      rules: [
        {
          matches: [],
          value: Style.define({ text: { color: base.color.ink } }),
        },
        ...recipe.rules,
      ],
    },
    vars: { alternate, base },
  } as const

  describe(`native variants / ${label} / 2 vars / 2 schemes`, () => {
    bench(
      'compile',
      () => {
        if (label === '512 selections rejected') {
          try {
            Variants.compile(options)
          } catch (error) {
            if (error instanceof Variants.CompileError) return
            throw error
          }
          throw new Error(
            'Expected the selection budget to reject this recipe.',
          )
        }
        Variants.compile(options)
      },
      {
        iterations: 30,
        setup: async () => {
          if (label === '512 selections rejected') return
          const output = Variants.compile(options)
          const tables = Object.values(output.styles).flatMap((set) =>
            Object.values(set).flatMap(Object.values),
          )
          const directory = Path.resolve('bench/results/native-variants')
          await Fs.mkdir(directory, { recursive: true })
          await Fs.writeFile(
            Path.join(directory, `${label.split(' ')[0]}.json`),
            JSON.stringify(
              {
                entries: tables.length,
                jsonBytes: Buffer.byteLength(JSON.stringify(output)),
                uniqueStyles: new Set(tables).size,
              },
              null,
              2,
            ),
          )
        },
        time: 1000,
        warmupIterations: 10,
        warmupTime: 500,
      },
    )
  })
}
