/** Checks inferred native labels and explicit native authoring constraints. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Style, Theme } from 'zyzz'
import { StyleSheet } from 'zyzz/react-native'
import type { StyleProp as NativeStyleProp } from '../../test/fixtures/native/StyleProp.js'

describe('compose', () => {
  test('preserves native array assignability, literals, and absent-operand identity', () => {
    const override = { opacity: 0.5 }
    const composed = StyleSheet.compose({ position: 'absolute' }, { top: 0 })
    const identity = StyleSheet.compose(false, override)

    expectTypeOf(composed).toMatchTypeOf<
      NativeStyleProp<{ position?: 'absolute'; top?: number }>
    >()
    expectTypeOf<StyleSheet.StyleProp<{ opacity: number }>>().toMatchTypeOf<
      NativeStyleProp<{ opacity: number }>
    >()
    expectTypeOf(identity).toEqualTypeOf<typeof override>()
    expectTypeOf(StyleSheet.compose(override, null)).toEqualTypeOf<
      typeof override
    >()
    expectTypeOf(StyleSheet.flatten(identity)).toEqualTypeOf<typeof override>()
    expectTypeOf(StyleSheet.flatten([{ position: 'absolute' }])).toMatchTypeOf<{
      position?: 'absolute'
    }>()

    const mixed = null as unknown as
      | { position: 'absolute' }
      | readonly StyleSheet.StyleProp<{ position: 'absolute' }>[]
    const flattened = StyleSheet.flatten(mixed)
    expectTypeOf<
      Extract<typeof flattened, readonly unknown[]>
    >().toEqualTypeOf<never>()
    expectTypeOf(flattened).toMatchTypeOf<{ position?: 'absolute' }>()
  })

  test('accepts compiled styles and external native arrays without erasing types', () => {
    const output = StyleSheet.compile({
      styles: Style.define({ card: { padding: '1px' } }),
    })
    const override = { opacity: 0.5 }
    const combined = StyleSheet.compose(output.styles.default.dark.card, [
      null,
      override,
    ])

    expectTypeOf(combined).not.toBeAny()
    expectTypeOf(StyleSheet.flatten(override)).toEqualTypeOf<typeof override>()
    expectTypeOf(StyleSheet.flatten(null)).toEqualTypeOf<undefined>()
    expectTypeOf(StyleSheet.absoluteFill.position).toEqualTypeOf<'absolute'>()
    // @ts-expect-error Strings containing CSS declarations are not native style objects.
    StyleSheet.compose(output.styles.default.dark.card, 'color:red')
  })
})

describe('compile', () => {
  test('keeps portable native constraints inside shared authoring domains', () => {
    const label = {
      textDecorationLine: 'line-through underline',
      aspectRatio: 1.5,
    } satisfies StyleSheet.Properties
    const output = StyleSheet.compile({ styles: Style.define({ label }) })

    expectTypeOf(
      output.styles.default.light.label.textDecorationLine,
    ).toEqualTypeOf<
      | 'line-through'
      | 'none'
      | 'underline'
      | 'underline line-through'
      | undefined
    >()
    // @ts-expect-error Bare numeric strings are not accepted by shared authoring.
    const ratio = { aspectRatio: '1.5' } satisfies StyleSheet.Properties
    // @ts-expect-error Native-only contain requires a target-specific authoring boundary.
    const selection = { userSelect: 'contain' } satisfies StyleSheet.Properties
    expectTypeOf(ratio).not.toBeAny()
    expectTypeOf(selection).not.toBeAny()
  })

  test('accepts portable scalar additions and retains native output types', () => {
    const declarations = {
      aspectRatio: '16 / 9',
      objectFit: 'cover',
      textDecorationStyle: 'wavy',
      direction: 'rtl',
    } satisfies StyleSheet.Properties
    const output = StyleSheet.compile({
      styles: Style.define({ card: declarations }),
    })

    expectTypeOf(output.styles.default.light.card.aspectRatio).toEqualTypeOf<
      number | undefined
    >()
    // @ts-expect-error Native image fitting has no fill-box keyword.
    const invalid = { objectFit: 'fill-box' } satisfies StyleSheet.Properties
    expectTypeOf(invalid).not.toBeAny()
  })

  test('retains style and theme labels through native lookup', () => {
    const base = Theme.define({ spacing: { md: '1rem' } })
    const styles = Style.define({
      card: { padding: base.tokens.spacing.md } satisfies StyleSheet.Properties,
    })
    const output = StyleSheet.compile({
      styles,
      themes: { base },
      units: { rem: 16 },
    })
    const selected = StyleSheet.select(output.styles, {
      theme: 'base',
      colorScheme: 'dark',
    })

    expectTypeOf<keyof typeof output.styles>().toEqualTypeOf<'base'>()
    expectTypeOf<keyof typeof selected>().toEqualTypeOf<'card'>()
    expectTypeOf(selected.card).toEqualTypeOf<StyleSheet.NativeStyle>()
    // @ts-expect-error Theme labels come from the compiled table.
    StyleSheet.select(output.styles, { theme: 'missing', colorScheme: 'dark' })
    // @ts-expect-error Device preferences must be resolved by a host.
    StyleSheet.select(output.styles, { theme: 'base', colorScheme: 'system' })
  })

  test('constrains native authoring before shared definitions erase property types', () => {
    // @ts-expect-error Grid is a web-only display value.
    const grid = { display: 'grid' } satisfies StyleSheet.Properties
    const query = {
      // @ts-expect-error Media queries need explicit host inputs and are not static native declarations.
      '@media (width > 10px)': { padding: '1px' },
    } satisfies StyleSheet.Properties
    // @ts-expect-error Font-relative em units lack a portable conversion.
    const units = { padding: '1em' } satisfies StyleSheet.Properties
    // @ts-expect-error CSS fallback arrays are unsupported.
    const fallback = { color: ['red', 'blue'] } satisfies StyleSheet.Properties
    const theme = Theme.define({
      color: { ink: 'red' },
      spacing: { md: '1rem' },
    })
    const variable = {
      // @ts-expect-error Web variables are distinct from portable tokens.
      color: theme.vars.color.ink,
    } satisfies StyleSheet.Properties
    const domain = {
      // @ts-expect-error Native tokens retain property domains.
      padding: theme.tokens.color.ink,
    } satisfies StyleSheet.Properties

    expectTypeOf(grid).not.toBeAny()
    expectTypeOf(query).not.toBeAny()
    expectTypeOf(units).not.toBeAny()
    expectTypeOf(fallback).not.toBeAny()
    expectTypeOf(variable).not.toBeAny()
    expectTypeOf(domain).not.toBeAny()
  })
})
