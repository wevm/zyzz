/**
 * Verifies configuration modes, token domains, and exact layer-key inference.
 * @module
 */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Config, Theme } from 'zyzz'

describe('create', () => {
  test('checks configured callback domains', () => {
    const { css } = Config.create()
    // @ts-expect-error Configured callbacks cannot use broad numbers for integer slots.
    css((values: { order: number }) => ({ order: values.order }))
    // @ts-expect-error Reserved styling fields cannot be callback slots.
    css((values: { style: string }) => ({ color: values.style }))
    css((values: { alpha: number }) => ({ opacity: values.alpha }))
  })

  test('preserves token domains in grouped styles from destructured helpers', () => {
    const { css, theme } = Config.create({
      theme: { color: { brand: '#06c' }, spacing: { md: '8px' } },
    })
    const styles = {
      card: css({ padding: 'md' }),
      label: css({ color: theme.tokens.color.brand }),
    }
    expectTypeOf(styles.card).toEqualTypeOf<typeof styles.label>()
    // @ts-expect-error Token names remain constrained after destructuring.
    css({ padding: 'missing' })
    // @ts-expect-error References retain their property domains.
    css({ padding: theme.tokens.color.brand })
  })

  test('keeps unthemed configuration token-free', () => {
    const empty = Config.create()
    empty.css({ color: '#fff', padding: '8px' })
    // @ts-expect-error Root config has no tokens.
    empty.css({ padding: 'md' })
    // @ts-expect-error Token-free config has no theme handle.
    void empty.theme
  })

  test('infers a single theme and exact layer keys', () => {
    const base = Theme.define({
      color: { brand: '#06c' },
      spacing: { md: '8px' },
    })
    const single = Config.create({
      layers: ['base', 'components'],
      theme: base,
    })
    single.css({ color: 'brand', padding: single.theme.tokens.spacing.md })
    single.css({
      '@layer components': { color: 'brand', '@layer base': { padding: 'md' } },
    })
    // @ts-expect-error Misspelled layer.
    single.css({ '@layer component': { color: 'brand' } })
    // @ts-expect-error Layer bodies retain token checking.
    single.css({ '@layer components': { color: 'missing' } })
    // @ts-expect-error References retain property domains inside layers.
    single.css({ '@layer base': { padding: single.theme.tokens.color.brand } })
    // @ts-expect-error Unknown style keys through variables remain invalid.
    single.css({ colour: '#06c' } as const)
    // @ts-expect-error Single-theme config has no catalog.
    void single.themes

    // Scoped selectors retain the same bound token inference.
    single.css({ ':hover': { color: 'brand' } })
  })

  test('validates named themes and configuration modes', () => {
    const base = Theme.define({
      color: { brand: '#06c' },
      spacing: { md: '8px' },
    })
    const named = Config.create({
      defaultTheme: 'base',
      themes: {
        base,
        mint: {
          color: { brand: { light: '#175', dark: '#afa' } },
          spacing: { md: '12px' },
        },
      },
    })
    named.css({ color: 'brand', padding: 'md' })
    expectTypeOf(named.themes.mint.tokens.color.brand).toEqualTypeOf<
      Theme.Reference<'color'>
    >()
    // @ts-expect-error Missing default.
    Config.create({ themes: { base } })
    // @ts-expect-error Unknown default.
    Config.create({ defaultTheme: 'missing', themes: { base } })
    // @ts-expect-error Modes are mutually exclusive.
    Config.create({ theme: base, themes: { base }, defaultTheme: 'base' })
    // @ts-expect-error Default requires a catalog.
    Config.create({ theme: base, defaultTheme: 'base' })
    Config.create({
      defaultTheme: 'base',
      // @ts-expect-error Complete alternatives must include spacing.
      themes: { base, mint: { color: { brand: '#175' } } },
    })
    Config.create({
      defaultTheme: 'base',
      themes: {
        base,
        mint: {
          // @ts-expect-error Extra tokens are incompatible.
          color: { brand: '#175', extra: '#000' },
          spacing: { md: '8px' },
        },
      },
    })
    const incomplete = Theme.define({ color: { brand: '#175' } })
    // @ts-expect-error Reusable definitions must also have complete paths.
    Config.create({ defaultTheme: 'base', themes: { base, incomplete } })
    // @ts-expect-error Wrong inline token group.
    Config.create({ theme: { colors: { brand: '#fff' } } })
    // @ts-expect-error Incomplete color pair.
    Config.create({ theme: { color: { brand: { light: '#fff' } } } })
    Config.create({
      theme: {
        // @ts-expect-error Color pairs cannot carry extra properties.
        color: { brand: { light: '#fff', dark: '#000', extra: '#fff' } },
      },
    })
    // @ts-expect-error Unknown options are rejected through variables.
    Config.create({ theme: base, unknown: true } as const)
  })
})

describe('create', () => {
  test('rejects invalid union branches and empty callbacks', () => {
    const { css } = Config.create()
    const styles = {} as { color: '#fff' } | { ':hover': { colour: '#fff' } }
    // @ts-expect-error Each disjoint branch must contain valid nested properties.
    css(styles)
    // @ts-expect-error Callbacks require one scalar input parameter.
    css(() => ({ color: '#fff' }))
  })
})

describe('create', () => {
  test('rejects undeclared layer names with CSS separators', () => {
    const { css } = Config.create({ layers: ['base'] })
    // @ts-expect-error undeclared tab-separated layer
    css({ '@layer\tunknown': { color: 'red' } })
    // @ts-expect-error undeclared comment-separated layer
    css({ '@layer/**/unknown': { color: 'red' } })
    css({ '@layer': { color: 'red' }, '@layer base': { color: 'blue' } })
  })
})
