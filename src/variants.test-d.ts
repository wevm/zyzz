/** Verifies recipe inference and rejected authoring through the public entrypoint. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Config, Theme, variants } from 'zyzz'

describe('variants', () => {
  test('infers choices, booleans, null, defaults, compounds, and overrides', () => {
    const button = variants({
      base: { display: 'inline-flex' },
      variants: {
        size: { sm: { padding: '4px' }, lg: { padding: '12px' } },
        loading: { true: { opacity: 0.5 }, false: {} },
      },
      defaultVariants: { size: 'sm', loading: false },
      compoundVariants: [
        {
          when: { size: ['sm', 'lg'], loading: true },
          style: { color: 'red' },
        },
      ],
    })

    type Input = NonNullable<Parameters<typeof button>[0]>
    expectTypeOf<Input['size']>().toEqualTypeOf<
      'sm' | 'lg' | null | undefined
    >()
    expectTypeOf<Input['loading']>().toEqualTypeOf<boolean | null | undefined>()
    const extra = { size: 'sm', disabled: true } as const
    // @ts-expect-error Extra keys remain invalid through bindings.
    button(extra)
    // @ts-expect-error Only declared data attributes exist.
    void button()['data-typo']
    button()
    button({
      size: null,
      loading: undefined,
      className: 'external',
      style: { opacity: 1 },
      variables: { '--progress': 0.5 },
    })

    // @ts-expect-error Unknown choice.
    button({ size: 'huge' })
    // @ts-expect-error Component props are not recipe selections.
    button({ disabled: true })
    // @ts-expect-error Boolean axes take booleans.
    button({ loading: 'true' })
  })

  test('rejects invalid properties and recipe structure', () => {
    // @ts-expect-error Recipes have one element, without slots.
    variants({ slots: { root: {} } })
    // @ts-expect-error Unknown CSS property in the base.
    variants({ base: { colro: 'red' } })
    // @ts-expect-error Invalid CSS value in a choice.
    variants({ variants: { size: { small: { display: 'invalid' } } } })
    // @ts-expect-error Styling props are reserved axis names.
    variants({ variants: { style: { small: {} } } })
    variants({
      variants: { size: { small: {} } },
      // @ts-expect-error Defaults must name a defined choice.
      defaultVariants: { size: 'large' },
    })
    variants({
      variants: { size: { small: {} } },
      // @ts-expect-error Default axes must be defined.
      defaultVariants: { missing: 'small' },
    })
    variants({
      variants: { size: { small: {} } },
      compoundVariants: [
        // @ts-expect-error Compound styles retain value checking.
        { when: { size: 'small' }, style: { display: 'invalid' } },
      ],
    })
    variants({
      variants: { size: { small: {} } },
      // @ts-expect-error Compound axes must be defined.
      compoundVariants: [{ when: { missing: 'small' }, style: {} }],
    })
  })
})

describe('bound', () => {
  describe('variants', () => {
    test('keeps renamed theme helpers independently typed', () => {
      const theme = Theme.define({ color: { brand: '#06c' } })
      const { css: style, variants: recipe } = theme
      const base = style({ color: 'brand' })
      const button = recipe({
        variants: { intent: { primary: { color: 'brand' }, quiet: {} } },
      })

      expectTypeOf(base()).toHaveProperty('className')
      expectTypeOf<
        NonNullable<Parameters<typeof button>[0]>['intent']
      >().toEqualTypeOf<'primary' | 'quiet' | null | undefined>()
      // @ts-expect-error Unknown finite choice.
      button({ intent: 'missing' })
      // @ts-expect-error Unknown theme color.
      style({ color: 'missing' })
      // @ts-expect-error Unknown theme color in a recipe.
      recipe({ base: { color: 'missing' } })
    })

    test('retains tokens, mappings, layers, and HTML output', () => {
      const theme = Theme.define({
        color: { brand: '#06c' },
        spacing: { sm: '4px' },
      })
      const button = theme.variants({
        variants: { intent: { primary: { color: 'brand', padding: 'sm' } } },
      })
      expectTypeOf(button()).toHaveProperty('className')
      // @ts-expect-error Wrong token domain.
      theme.variants({ base: { padding: 'brand' } })
      const { variants, theme: configured } = Config.create({
        theme: { color: { brand: '#06c' } },
        output: 'html',
        layers: ['components'],
        shorthands: { px: ['paddingLeft', 'paddingRight'] },
      })
      const link = variants({
        base: { '@layer components': { px: '4px' } },
        variants: { intent: { primary: { color: 'brand' } } },
      })
      expectTypeOf(link()).toHaveProperty('class')
      expectTypeOf(
        configured.variants({ base: { px: '4px' } })(),
      ).toHaveProperty('class')
      const extended = Theme.extend(configured, { color: { brand: '#09c' } })
      expectTypeOf(extended.variants({ base: { px: '4px' } })()).toHaveProperty(
        'class',
      )
      // @ts-expect-error Unknown configured layer.
      variants({ base: { '@layer missing': { color: 'brand' } } })
      // @ts-expect-error Unknown configured token.
      variants({ base: { color: 'missing' } })
    })
  })
})

describe('conditions', () => {
  describe('variants', () => {
    test('retains condition names, axes, booleans, and nullable choices', () => {
      const button = variants({
        conditions: {
          wide: '@media (width >= 600px)',
          grid: '@supports (display: grid)',
        },
        variants: {
          size: { sm: {}, lg: {} },
          loading: { true: {}, false: {} },
        },
        defaultVariants: { size: 'sm' },
      })
      button({
        size: 'sm',
        conditions: {
          wide: { size: 'lg', loading: false },
          grid: { size: null, loading: undefined },
        },
      })
      button({ conditions: { wide: undefined } })
      button({ conditions: undefined })
      expectTypeOf(button()).toHaveProperty('className')
      // @ts-expect-error Unknown condition.
      button({ conditions: { missing: { size: 'lg' } } })
      // @ts-expect-error Unknown axis.
      button({ conditions: { wide: { intent: 'primary' } } })
      // @ts-expect-error Unknown finite choice.
      button({ conditions: { wide: { size: 'xl' } } })
      // @ts-expect-error Scoped selection does not accept styling overrides.
      button({ conditions: { wide: { style: { color: 'red' } } } })
      // @ts-expect-error Unsupported condition target.
      variants({ conditions: { wide: '@container (width > 1px)' } })
      // @ts-expect-error Reserved input property.
      variants({ variants: { conditions: { sm: {} } } })
      // @ts-expect-error Reserved attribute namespace.
      variants({ variants: { 'zyzz-condition-0-size': { sm: {} } } })
    })

    test('retains bound query aliases and HTML props', () => {
      const { variants: recipe } = Config.create({
        output: 'html',
        theme: { breakpoints: { md: '600px' } },
      })
      const button = recipe({
        conditions: { wide: '@media >=md' },
        variants: { size: { sm: {}, lg: {} } },
      })
      expectTypeOf(
        button({ conditions: { wide: { size: 'lg' } } }),
      ).toHaveProperty('class')
      // @ts-expect-error Query alias belongs to the bound theme.
      recipe({ conditions: { wide: '@media >=missing' } })
      // @ts-expect-error Root recipes have no named thresholds.
      variants({ conditions: { wide: '@media >=md' } })
    })

    test('preserves condition names in the transformed declaration shape', () => {
      type Compiled = variants.ReturnType<{
        conditions: { wide: unknown }
        variants: { size: { sm: {}; lg: {} } }
      }>
      expectTypeOf<
        NonNullable<Parameters<Compiled>[0]>['conditions']
      >().toEqualTypeOf<
        | {
            readonly wide?:
              | { readonly size?: 'sm' | 'lg' | null | undefined }
              | undefined
          }
        | undefined
      >()
    })
  })
})

describe('payloads', () => {
  describe('variants', () => {
    test('rejects static alternatives inside bound payload objects', () => {
      const button = variants({
        variants: {
          size: {
            sm: { padding: '4px' },
            custom: (values: { padding: `${number}px` }) => ({
              padding: values.padding,
            }),
          },
        },
      })
      const selection = { sm: true, custom: { padding: '16px' as const } }
      // @ts-expect-error A payload object must exclude every other declared choice.
      button({ size: selection })
    })
    test('rejects infinite payload fields', () => {
      variants({
        variants: {
          size: {
            // @ts-expect-error Payload field names must be finite.
            custom: (values: { padding: string; [field: string]: string }) => ({
              padding: values.padding,
            }),
          },
        },
      })
    })

    test('requires complete payloads and retains finite compound names', () => {
      const button = variants({
        conditions: { wide: '@media (width >= 600px)' },
        variants: {
          size: {
            sm: { padding: '4px' },
            custom: (values: { padding: `${number}px` }) => ({
              padding: values.padding,
            }),
            fluid: (values: { width: `${number}%` }) => ({
              width: values.width,
            }),
          },
        },
        defaultVariants: { size: { custom: { padding: '12px' } } },
        compoundVariants: [
          { when: { size: 'custom' }, style: { color: 'red' } },
        ],
      })
      button({
        size: { custom: { padding: '16px' } },
        conditions: { wide: { size: { custom: { padding: '24px' } } } },
      })
      button({ size: 'sm' })
      button({ size: null })
      expectTypeOf(button()).toHaveProperty('style')
      // @ts-expect-error Dynamic choices require payloads.
      button({ size: 'custom' })
      // @ts-expect-error Payload is incomplete.
      button({ size: { custom: {} } })
      // @ts-expect-error Payload domain is retained.
      button({ size: { custom: { padding: 'red' } } })
      // @ts-expect-error Exactly one dynamic choice per axis.
      button({ size: { custom: { padding: '1px' }, fluid: { width: '10%' } } })
    })
  })
})
