/**
 * Verifies configuration modes, token domains, and exact layer-key inference.
 * @module
 */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Config as PublicConfig } from 'zyzz'
import * as Theme from './internal/Theme.js'
import * as Config from './internal/Configuration.js'

describe('create', () => {
  test('requires tokens or bracketed CSS when values exist', () => {
    const { style, variants, vars } = PublicConfig.create({
      shorthands: { px: ['paddingLeft', 'paddingRight'] },
      vars: { color: { brand: 'red' }, spacing: { md: '8px' } },
    })
    style({
      padding: 'md',
      marginTop: '[7px]',
      color: '[#123456]',
      width: '[calc(100% - 2rem)]',
    })
    style({ color: vars.color.brand, padding: ['md', '[7px]'], px: '[7px]' })
    style({
      color: '[red] !important',
      display: 'flex',
      ':hover': { padding: '[2px]' },
    })
    style((values: { padding: '7px' }) => ({ padding: `[${values.padding}]` }))
    style({ opacity: '[0.5]' })
    // @ts-expect-error Brackets unwrap once and do not bypass CSS syntax.
    style({ padding: '[[7px]]' })
    // @ts-expect-error Empty escapes are not CSS values.
    style({ padding: '[]' })
    // @ts-expect-error Arbitrary mapped values require brackets.
    style({ padding: '7px' })
    // @ts-expect-error Every fallback is checked.
    style({ padding: ['md', '7px'] })
    // @ts-expect-error Brackets preserve CSS validation.
    style({ padding: '[invalid]' })
    // @ts-expect-error Malformed CSS remains invalid.
    style({ color: '[#oops]' })
    // @ts-expect-error The object escape was removed.
    style({ padding: { custom: '7px' } })
    // @ts-expect-error Nested styles retain token enforcement.
    style({ ':hover': { padding: '7px' } })
    // @ts-expect-error Variants retain token enforcement.
    variants({ variants: { size: { large: { padding: '7px' } } } })
    variants({
      base: { padding: 'md' },
      variants: { size: { large: { padding: '[7px]' } } },
    })
    // @ts-expect-error Arbitrary callback values require brackets.
    style((values: { padding: '7px' }) => ({ padding: values.padding }))
    // @ts-expect-error Shorthands retain token enforcement.
    style({ px: '7px' })
    // @ts-expect-error Compound variants retain token enforcement.
    variants({ compoundVariants: [{ when: {}, style: { padding: '7px' } }] })
    // @ts-expect-error Fallbacks remain nonempty.
    style({ padding: [] })
    PublicConfig.create({
      mappings: { ink: ['color'] },
      vars: { ink: { brand: 'red' } },
    }).style({ color: 'brand', backgroundColor: 'blue' })
    const full = PublicConfig.create({
      mappings: false,
      vars: { color: { brand: 'red' } },
    })
    full.style({ color: 'color.brand' })
    // @ts-expect-error Full paths require the complete token name.
    full.style({ color: 'red' })
    PublicConfig.create().style({ padding: '7px', color: '[red]' })
    PublicConfig.create({ vars: {} }).style({ padding: '[7px]', color: 'red' })
    // @ts-expect-error The strict option was removed.
    PublicConfig.create({ strict: true })
  })

  test('accepts defaultLayer with and without variable sets', () => {
    const { style, variants } = PublicConfig.create({
      defaultLayer: 'components',
      layers: ['components', 'overrides'],
      mappings: false,
      vars: { color: { brand: 'red' } },
    })
    expectTypeOf(
      style({ color: 'color.brand', '@layer overrides': { color: '[blue]' } })()
        .className,
    ).toEqualTypeOf<string>()
    expectTypeOf(
      variants({ base: { color: 'color.brand' } })().className,
    ).toEqualTypeOf<string>()
    PublicConfig.create({ defaultLayer: 'components.buttons' }).style({
      color: 'red',
    })
    // @ts-expect-error Default layers require a name.
    PublicConfig.create({ defaultLayer: false })
    // @ts-expect-error Unknown layers remain invalid explicit overrides.
    style({ '@layer unknown': { color: 'red' } })
  })

  test('infers style helpers with either CSS output mode', () => {
    const { style, variants } = Config.create({ cssOutput: 'grouped' })
    expectTypeOf(style({ color: 'red' })().className).toEqualTypeOf<string>()
    expectTypeOf(
      variants({ variants: { size: { large: { padding: '8px' } } } })({
        size: 'large',
      }).className,
    ).toEqualTypeOf<string>()
    Config.create({ cssOutput: 'atomic', output: 'html' })
    // @ts-expect-error Unsupported CSS representation.
    Config.create({ cssOutput: 'automatic' })
  })

  test('checks configured callback domains', () => {
    const { style } = Config.create()

    // @ts-expect-error Configured callbacks cannot use broad numbers for integer slots.
    style((values: { order: number }) => ({ order: values.order }))
    // @ts-expect-error Reserved styling fields cannot be callback slots.
    style((values: { style: string }) => ({ color: values.style }))
    style((values: { alpha: number }) => ({ opacity: values.alpha }))
  })

  test('preserves token domains in grouped styles from destructured helpers', () => {
    const { style, theme } = Config.create({
      theme: { color: { brand: '#06c' }, spacing: { md: '8px' } },
    })
    const card = style({ padding: 'md' })
    const label = style({ color: theme.tokens.color.brand })

    expectTypeOf(card).toEqualTypeOf<typeof label>()

    // @ts-expect-error Token names remain constrained after destructuring.
    style({ padding: 'missing' })
    // @ts-expect-error References retain their property domains.
    style({ padding: theme.tokens.color.brand })
  })

  test('keeps unthemed configuration token-free', () => {
    const empty = Config.create()

    empty.style({ color: '#fff', padding: '8px' })
    // @ts-expect-error Root config has no tokens.
    empty.style({ padding: 'md' })
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

    single.style({ color: 'brand', padding: single.theme.tokens.spacing.md })
    single.style({
      '@layer components': { color: 'brand', '@layer base': { padding: 'md' } },
    })
    // @ts-expect-error Misspelled layer.
    single.style({ '@layer component': { color: 'brand' } })
    // @ts-expect-error Layer bodies retain token checking.
    single.style({ '@layer components': { color: 'missing' } })
    const reference = single.theme.tokens.color.brand
    // @ts-expect-error References retain property domains inside layers.
    single.style({ '@layer base': { padding: reference } })
    // @ts-expect-error Unknown style keys through variables remain invalid.
    single.style({ colour: '#06c' } as const)
    // @ts-expect-error Single-theme config has no catalog.
    void single.themes

    // Scoped selectors retain the same bound token inference.
    single.style({ ':hover': { color: 'brand' } })
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

    named.style({ color: 'brand', padding: 'md' })

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
  test('binds root appearance controls to the catalog', () => {
    const named = Config.create({
      defaultTheme: 'base',
      storageKey: 'app',
      themes: {
        base: { color: { brand: '#06c' } },
        mint: { color: { brand: '#175' } },
      },
    })

    expectTypeOf(named.appearance.get()).toEqualTypeOf<{
      readonly colorScheme?: 'dark' | 'light' | 'light dark' | undefined
      readonly set: 'base' | 'mint'
    }>()
    named.appearance.set({ colorScheme: 'dark' })
    named.appearance.set({ set: 'mint' })
    // @ts-expect-error Unknown catalog names are rejected.
    named.appearance.set({ set: 'ocean' })

    const single = Config.create({ theme: { color: { brand: '#06c' } } })

    expectTypeOf(single.appearance.get()).toEqualTypeOf<{
      readonly colorScheme?: 'dark' | 'light' | 'light dark' | undefined
    }>()
    // @ts-expect-error Single themes select only a scheme.
    single.appearance.set({ set: 'base' })
    // @ts-expect-error Storage keys are strings.
    Config.create({ storageKey: 42 })
  })
})

describe('create', () => {
  test('rejects invalid union branches and empty callbacks', () => {
    const { style } = Config.create()
    const styles = {} as { color: '#fff' } | { ':hover': { colour: '#fff' } }

    // @ts-expect-error Each disjoint branch must contain valid nested properties.
    style(styles)
    // @ts-expect-error Callbacks require one scalar input parameter.
    style(() => ({ color: '#fff' }))
  })
})

describe('create', () => {
  test('rejects undeclared layer names with CSS separators', () => {
    const { style } = Config.create({ layers: ['base'] })
    // @ts-expect-error undeclared tab-separated layer
    style({ '@layer\tunknown': { color: 'red' } })
    // @ts-expect-error undeclared comment-separated layer
    style({ '@layer/**/unknown': { color: 'red' } })
    style({ '@layer': { color: 'red' }, '@layer base': { color: 'blue' } })
  })
})
