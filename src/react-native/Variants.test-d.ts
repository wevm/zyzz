import { Vars } from 'zyzz'
/** Checks literal native recipe metadata and set labels through public imports. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Style } from 'zyzz'
import { Source } from 'zyzz/compiler'
import { StyleSheet, Variants } from 'zyzz/react-native'

describe('compile', () => {
  test('preserves inline axes, choices, defaults, and named vars', () => {
    const set = Vars.define({ color: { ink: 'red' } })
    const output = Variants.compile({
      recipe: {
        axes: { tone: ['quiet', 'loud'], size: ['small'] },
        defaults: { tone: 'quiet', size: null },
        rules: [{ matches: [], value: Style.define({ card: { opacity: 1 } }) }],
      },
      vars: { brand: set, alternate: set },
    })

    expectTypeOf<keyof typeof output.axes>().toEqualTypeOf<'size' | 'tone'>()
    expectTypeOf(output.axes.tone).toEqualTypeOf<readonly ['quiet', 'loud']>()
    expectTypeOf(output.defaults).toEqualTypeOf<{
      readonly tone: 'quiet'
      readonly size: null
    }>()
    expectTypeOf<keyof typeof output.styles>().toEqualTypeOf<
      'alternate' | 'brand'
    >()
    expectTypeOf(
      StyleSheet.select(output.styles, {
        colorScheme: 'dark',
        set: 'brand',
      })['0'],
    ).toEqualTypeOf<StyleSheet.NativeStyle | undefined>()
    // @ts-expect-error Only declared set labels are available.
    expectTypeOf(output.styles.typo).not.toBeAny()
    // @ts-expect-error Selection retains compiled set labels.
    StyleSheet.select(output.styles, { colorScheme: 'light', set: 'typo' })
    // @ts-expect-error Only declared axes are available.
    expectTypeOf(output.axes.typo).not.toBeAny()
    // @ts-expect-error Choice names retain the finite recipe contract.
    const choice: (typeof output.axes.tone)[number] = 'typo'
    // @ts-expect-error Compiled choice lists are immutable.
    output.axes.tone.push('quiet')
    expectTypeOf(choice).not.toBeAny()
  })

  test('retains const recipe inputs and infers the omitted set', () => {
    const recipe = {
      axes: { active: ['true', 'false'] },
      defaults: { active: 'false' },
      rules: [],
    } as const
    const output = Variants.compile({ recipe })

    expectTypeOf(output.axes).toEqualTypeOf<typeof recipe.axes>()
    expectTypeOf(output.defaults).toEqualTypeOf<typeof recipe.defaults>()
    expectTypeOf<keyof typeof output.styles>().toEqualTypeOf<'default'>()
    // @ts-expect-error Omitted vars only produce the default table.
    expectTypeOf(output.styles.brand).not.toBeAny()
  })

  test('accepts extracted recipes and explicitly typed options', () => {
    const recipe = Source.extract({
      moduleId: 'card.ts',
      source: `import { variants } from 'zyzz'; export const card = variants({ variants: { tone: { quiet: { opacity: 0.5 } } } });`,
    }).calls[0]!.staticRecipe!
    const options: Variants.compile.Options = { recipe }
    const output = Variants.compile(options)

    expectTypeOf(output).toMatchTypeOf<Variants.Definition>()
    expectTypeOf(output).toEqualTypeOf<Variants.compile.ReturnType>()
    expectTypeOf(output.axes).toEqualTypeOf<
      Readonly<Record<string, readonly string[]>>
    >()
  })
})
