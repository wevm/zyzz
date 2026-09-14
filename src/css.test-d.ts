/**
 * Checks consumer inference and rejected inputs through the public css API.
 * @module
 */
/* oxlint-disable typescript/restrict-template-expressions -- Selector references are resolved at compile time. */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Config, css, Style, Theme } from 'zyzz'
import { counterStyle, fontPaletteValues, positionTry } from 'zyzz/web'

describe('css', () => {
  test('retains inference with explicit definition identities', () => {
    const card = css({ color: 'red' }, { id: 'card' })
    const bar = css(
      (values: { width: `${number}px` }) => ({ width: values.width }),
      { id: 'bar' },
    )

    expectTypeOf(card).toEqualTypeOf<css.ReturnType>()
    bar({ width: '8px' })
    // @ts-expect-error IDs do not widen callback input types.
    bar({ width: 'red' })
    // @ts-expect-error Definition identities are strings.
    css({ color: 'red' }, { id: 1 })
  })

  test('accepts empty root, theme, and configured definitions', () => {
    const empty = css()
    const theme = Theme.define({})
    const config = Config.create({ theme: {} })
    const html = Config.create({ output: 'html', theme: {} })

    expectTypeOf(empty).toEqualTypeOf<css.ReturnType>()
    expectTypeOf(theme.css()).toEqualTypeOf<css.ReturnType>()
    expectTypeOf(config.css()).toEqualTypeOf<css.ReturnType>()
    expectTypeOf(html.css()).toEqualTypeOf<css.ReturnType<'html'>>()
    css({ selectors: { [`${empty} > &`]: { color: 'red' } } })
    empty({ className: 'external' })
    // @ts-expect-error Empty styles still reject unrelated props.
    empty({ id: 'card' })
  })

  test('infers callback templates and rejects CSS-wide scalar domains', () => {
    const style = css((v: { gap: `${number}px` }) => ({
      marginLeft: `calc(${v.gap} + 2px)`,
    }))

    style({ gap: '2px' })

    const theme = Theme.define({ spacing: { '-1': '1px' } })

    theme.css((v: { alpha: number }) => ({ padding: '-1', opacity: v.alpha }))
    // @ts-expect-error CSS-wide keywords apply to the private property, not its consumer.
    css((v: { color: 'initial' | 'red' }) => ({ color: v.color }))
  })

  test('preserves static template value constraints', () => {
    expectTypeOf(
      css({ padding: `${8}px`, width: `calc(100% - ${16}px)` }),
    ).toEqualTypeOf<css.ReturnType>()

    // @ts-expect-error A static template does not bypass the length domain.
    css({ padding: `${8}invalid` })
    // @ts-expect-error Nonnegative length domains still reject negative literals.
    css({ padding: `${-8}px` })
  })

  test('infers applied props and rejects invalid styles and overrides', () => {
    const card = css({ color: '#fff', padding: '1rem' })

    expectTypeOf(card).toEqualTypeOf<css.ReturnType>()
    expectTypeOf(
      card({ className: 'external', style: { opacity: 0.5 } }),
    ).toEqualTypeOf<css.Props>()

    // @ts-expect-error Unknown properties cannot hide in aliased objects.
    css({ colour: '#fff' })
    // @ts-expect-error Root calls contain no spacing tokens.
    css({ padding: 4 })
    // @ts-expect-error Root calls contain no color tokens.
    css({ color: 'blue.700' })
    // @ts-expect-error Dynamic callbacks require an explicitly typed values parameter.
    css(() => ({ padding: 0 }))
    // @ts-expect-error Unrelated component props are not styling overrides.
    card({ id: 'card' })

    const union = {} as { color: '#fff' } | { colour: '#fff'; color: '#fff' }

    // @ts-expect-error Unknown keys in a union branch are rejected.
    css(union)
  })
})

describe('atRules', () => {
  describe('css', () => {
    test('accepts nested scope and scroll-state conditions', () => {
      css({
        '@scope (.card) to (.stop)': {
          '@container scroll-state(stuck: top)': { color: 'red' },
        },
      })
      css({ '@media\n(width > 1px)': { color: 'red' } })
    })
  })
})

describe('conditions', () => {
  describe('css', () => {
    test('validates every branch of aliased style unions', () => {
      const invalid = null as unknown as
        | { color: '#fff' }
        | { ':hover': { colour: '#fff' } }

      // @ts-expect-error Disjoint outer keys do not hide invalid nested declarations.
      css(invalid)
    })
    test('retains recursive literal and bound contracts', () => {
      css({
        '--escaped\\&name': 'red',
        '@container style(--active: true)': { color: 'red' },
        '@container sidebar style(--active: true)': { color: 'red' },
      })
      Theme.define({ breakpoints: { 640: '40rem' } }).css({
        '@media 640': { color: 'red' },
      })
      // @ts-expect-error Concrete undefined conditions are rejected.
      css({ ':hover': undefined })
      css({
        ':hover': { color: 'red' },
        '&[data-active]': { opacity: 0.5 },
        '@media (width >= 800px)': { display: 'grid' },
      })

      const theme = Theme.define({
        breakpoints: { tablet: '48rem', desktop: '64rem' },
        containers: { card: '24rem' },
        containerNames: ['sidebar'],
        spacing: { gap: '4px' },
      })

      theme.css({
        '@media tablet..desktop': { ':hover': { padding: 'gap' } },
        '@container sidebar >=card': { display: 'grid' },
      })
      theme.css((values: { alpha: number }) => ({
        ':hover': { opacity: values.alpha },
      }))
      // @ts-expect-error Bare aliases must belong to this theme.
      theme.css({ '@media missing': { display: 'grid' } })
      // @ts-expect-error Root authoring has no aliases.
      css({ '@media tablet': { display: 'grid' } })
      // @ts-expect-error Nested property names remain exact.
      css({ ':hover': { colour: 'red' } })
      // @ts-expect-error Nested numeric lengths remain invalid.
      theme.css({ '@media tablet': { width: 10 } })
      // @ts-expect-error Nested token domains cannot cross properties.
      theme.css({ ':hover': { color: theme.tokens.spacing.gap } })
    })
  })
})

describe('dynamic', () => {
  describe('css', () => {
    test('rejects constrained numbers and reserved runtime domains', () => {
      const bound = Theme.define({ color: { ink: 'red' } })

      // @ts-expect-error Bound callbacks reject reserved component fields too.
      bound.css((v: { ref: number }) => ({ opacity: v.ref }))
      // @ts-expect-error Bound callbacks reject unconstrained integer slots too.
      bound.css((v: { level: number }) => ({ zIndex: v.level }))
      // @ts-expect-error Arbitrary numbers cannot satisfy integer properties.
      css((v: { level: number }) => ({ zIndex: v.level }))
      // @ts-expect-error Component refs are not styling values.
      css((v: { ref: number }) => ({ opacity: v.ref }))
      // @ts-expect-error Importance belongs to declarations, not runtime values.
      css((v: { width: `${number}%!` }) => ({ width: v.width }))
    })
    test('checks static callback literals', () => {
      // @ts-expect-error Negative padding remains invalid in callbacks.
      css((v: { alpha: number }) => ({ opacity: v.alpha, padding: '-1px' }))

      const theme = Theme.define({ color: { ink: 'red' } })

      // @ts-expect-error Bound callbacks apply the same literal checks.
      theme.css((v: { alpha: number }) => ({
        opacity: v.alpha,
        padding: '-1px',
      }))
    })
    test('retains required input domains and styling overrides', () => {
      const bar = css((values: { amount: `${number}%`; alpha: number }) => ({
        width: values.amount,
        opacity: values.alpha,
        display: 'block',
      }))

      expectTypeOf(
        bar({ amount: '50%', alpha: 0.5 }),
      ).toEqualTypeOf<css.Props>()

      bar({
        amount: '50%',
        alpha: 0.5,
        className: 'external',
        style: { color: 'red' },
      })
      // @ts-expect-error Missing required values are rejected.
      bar({ amount: '50%' })
      // @ts-expect-error Runtime values retain their literal domain.
      bar({ amount: '50px', alpha: 1 })
      // @ts-expect-error Unrelated component props are not forwarded.
      bar({ amount: '50%', alpha: 1, id: 'bad' })

      const theme = Theme.define({ color: { brand: 'red' } })
      const themed = theme.css((values: { alpha: number }) => ({
        color: 'brand',
        opacity: values.alpha,
      }))

      themed({ alpha: 0.5 })
      // @ts-expect-error Dynamic bound values remain required.
      themed({})
      // @ts-expect-error Bound declarations keep property domains.
      theme.css((values: { width: number }) => ({ width: values.width }))
      // @ts-expect-error Dynamic CSS properties remain typed.
      css((values: { width: number }) => ({ width: values.width }))
    })
  })
})

describe('namedRules', () => {
  describe('css', () => {
    test('rejects identities from unrelated domains', () => {
      const dots = counterStyle({ symbols: '"x"' })
      const palette = fontPaletteValues({ fontFamily: 'Body', basePalette: 0 })
      const below = positionTry({ positionArea: 'bottom' })
      css({
        listStyleType: dots,
        fontPalette: palette,
        positionTryFallbacks: below,
      })
      // @ts-expect-error palette is not a counter
      css({ listStyleType: palette })
      // @ts-expect-error counter is not a palette
      css({ fontPalette: dots })
    })
  })
})

describe('selectors', () => {
  describe('css', () => {
    test('accepts strings and style-reference interpolation', () => {
      const card = css()
      const dynamic = css((values: { opacity: number }) => ({
        opacity: values.opacity,
      }))
      const config = Config.create({ theme: { color: { brand: '#06c' } } })
      const themed = config.css({ color: 'brand' })

      css({
        selectors: {
          '&:hover': { color: 'blue' },
          [`${card} > &`]: { color: 'blue' },
          [`&:has(${dynamic})`]: { opacity: 0.5 },
        },
      })
      config.css({ selectors: { [`${themed} + &`]: { color: 'brand' } } })
      css((values: { opacity: number }) => ({
        selectors: { [`${card}:hover &`]: { opacity: values.opacity } },
      }))

      // @ts-expect-error Nested values retain their CSS contracts.
      css({ selectors: { [`${card} &`]: { display: 'unknown-display' } } })
      // @ts-expect-error Nested properties remain exact.
      css({ selectors: { '&:hover': { colour: 'red' } } })
      // @ts-expect-error Root styles do not have configured tokens.
      css({ selectors: { '&:hover': { color: 'brand' } } })
      // @ts-expect-error Core definitions do not resolve compiler-owned selector groups.
      Style.define({ label: { selectors: { '&:hover': { color: 'red' } } } })
    })
  })
})
