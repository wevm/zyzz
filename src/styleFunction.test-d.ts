/**
 * Checks consumer inference and rejected inputs through the public style API.
 * @module
 */
/* oxlint-disable typescript/restrict-template-expressions -- Selector references are resolved at compile time. */
import type { ComponentPropsWithoutRef, CSSProperties } from 'react'
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { style, Style } from 'zyzz'
import * as Theme from './internal/Theme.js'
import * as Config from './internal/Configuration.js'
import { counterStyle, fontPaletteValues, positionTry } from 'zyzz/web'

describe('style', () => {
  test('accepts React inline styles without weakening authored declarations', () => {
    const card = style({ padding: '8px' })
    const dynamic = style((values: { width: `${number}%` }) => ({
      width: values.width,
    }))
    const themed = Theme.define({ spacing: { md: '8px' } }).style({
      padding: 'md',
    })
    const configured = Config.create({ theme: {} }).style({ padding: '8px' })
    const inline: CSSProperties = {
      color: 'var(--ink)',
      opacity: undefined,
      padding: 12,
    }
    const props: ComponentPropsWithoutRef<'button'> = {
      className: 'external',
      style: inline,
    }

    expectTypeOf<CSSProperties>().toExtend<
      NonNullable<style.Options['style']>
    >()
    expectTypeOf(
      card({ className: props.className, style: props.style }),
    ).toEqualTypeOf<style.Props>()
    dynamic({ style: props.style, width: '50%' })
    themed({ style: props.style })
    configured({ style: props.style })
    card({ style: { '--accent': undefined, padding: 12 } })
    card({ style: undefined })

    // @ts-expect-error Inline values remain scalar.
    card({ style: { opacity: false } })
    // @ts-expect-error Conditions belong in authored declarations.
    card({ style: { color: { ':hover': 'red' } } })
    // @ts-expect-error Authored lengths still require units or configured tokens.
    style({ padding: 12 })
    // @ts-expect-error Authored values retain CSS domain checks.
    style({ display: 'invalid' })
  })

  test('retains inference with explicit definition identities', () => {
    const card = style({ color: 'red' }, { id: 'card' })
    const bar = style(
      (values: { width: `${number}px` }) => ({ width: values.width }),
      { id: 'bar' },
    )

    expectTypeOf(card).toEqualTypeOf<style.ReturnType>()
    bar({ width: '8px' })
    // @ts-expect-error IDs do not widen callback input types.
    bar({ width: 'red' })
    // @ts-expect-error Definition identities are strings.
    style({ color: 'red' }, { id: 1 })
  })

  test('accepts empty root, theme, and configured definitions', () => {
    const empty = style()
    const theme = Theme.define({})
    const config = Config.create({ theme: {} })
    const html = Config.create({ output: 'html', theme: {} })

    expectTypeOf(empty).toEqualTypeOf<style.ReturnType>()
    expectTypeOf(theme.style()).toEqualTypeOf<style.ReturnType>()
    expectTypeOf(config.style()).toEqualTypeOf<style.ReturnType>()
    expectTypeOf(html.style()).toEqualTypeOf<style.ReturnType<'html'>>()
    style({ selectors: { [`${empty} > &`]: { color: 'red' } } })
    empty({ className: 'external' })
    // @ts-expect-error Empty styles still reject unrelated props.
    empty({ id: 'card' })
  })

  test('infers callback templates and rejects CSS-wide scalar domains', () => {
    const card = style((v: { gap: `${number}px` }) => ({
      marginLeft: `calc(${v.gap} + 2px)`,
    }))

    card({ gap: '2px' })

    const theme = Theme.define({ spacing: { '-1': '1px' } })

    theme.style((v: { alpha: number }) => ({ padding: '-1', opacity: v.alpha }))
    // @ts-expect-error CSS-wide keywords apply to the private property, not its consumer.
    style((v: { color: 'initial' | 'red' }) => ({ color: v.color }))
  })

  test('preserves static template value constraints', () => {
    expectTypeOf(
      style({ padding: `${8}px`, width: `calc(100% - ${16}px)` }),
    ).toEqualTypeOf<style.ReturnType>()

    // @ts-expect-error A static template does not bypass the length domain.
    style({ padding: `${8}invalid` })
    // @ts-expect-error Nonnegative length domains still reject negative literals.
    style({ padding: `${-8}px` })
  })

  test('infers applied props and rejects invalid styles and overrides', () => {
    const card = style({ color: '#fff', padding: '1rem' })

    expectTypeOf(card).toEqualTypeOf<style.ReturnType>()
    expectTypeOf(
      card({ className: 'external', style: { opacity: 0.5 } }),
    ).toEqualTypeOf<style.Props>()

    // @ts-expect-error Unknown properties cannot hide in aliased objects.
    style({ colour: '#fff' })
    // @ts-expect-error Root calls contain no spacing tokens.
    style({ padding: 4 })
    // @ts-expect-error Root calls contain no color tokens.
    style({ color: 'blue.700' })
    // @ts-expect-error Dynamic callbacks require an explicitly typed values parameter.
    style(() => ({ padding: 0 }))
    // @ts-expect-error Unrelated component props are not styling overrides.
    card({ id: 'card' })

    const union = {} as { color: '#fff' } | { colour: '#fff'; color: '#fff' }

    // @ts-expect-error Unknown keys in a union branch are rejected.
    style(union)
  })
})

describe('atRules', () => {
  describe('style', () => {
    test('accepts nested scope and scroll-state conditions', () => {
      style({
        '@scope (.card) to (.stop)': {
          '@container scroll-state(stuck: top)': { color: 'red' },
        },
      })
      style({ '@media\n(width > 1px)': { color: 'red' } })
    })
  })
})

describe('conditions', () => {
  describe('style', () => {
    test('validates every branch of aliased style unions', () => {
      const invalid = null as unknown as
        | { color: '#fff' }
        | { ':hover': { colour: '#fff' } }

      // @ts-expect-error Disjoint outer keys do not hide invalid nested declarations.
      style(invalid)
    })

    test('validates declarations independently of completion hints', () => {
      style({
        '@media (min-width: 768px)': {
          fontSize: '72px',
          width: 'auto',
          '::before': { content: '""', display: 'block' },
        },
      })
      const { style: configured } = Config.create({
        theme: { fontSize: { hero: '72px' } },
      })
      configured({ '@media (min-width: 768px)': { fontSize: 'hero' } })

      // @ts-expect-error Suggested at-rule prefixes still require a query.
      style({ '@media': { width: 'auto' } })
      // @ts-expect-error Nested hints do not accept unknown declarations.
      style({ '@media (min-width: 768px)': { fontSzie: '72px' } })
      // @ts-expect-error Nested widths still require a CSS value.
      style({ '@media (min-width: 768px)': { width: '' } })
      // @ts-expect-error Configured nested declarations keep their value domains.
      configured({ '::before': { display: 'invalid-display' } })
    })

    test('retains recursive literal and bound contracts', () => {
      style({
        '--escaped\\&name': 'red',
        '@container style(--active: true)': { color: 'red' },
        '@container sidebar style(--active: true)': { color: 'red' },
      })
      Theme.define({ breakpoints: { 640: '40rem' } }).style({
        '@media 640': { color: 'red' },
      })
      // @ts-expect-error Concrete undefined conditions are rejected.
      style({ ':hover': undefined })
      style({
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

      theme.style({
        '@media tablet..desktop': { ':hover': { padding: 'gap' } },
        '@container sidebar >=card': { display: 'grid' },
      })
      theme.style((values: { alpha: number }) => ({
        ':hover': { opacity: values.alpha },
      }))
      // @ts-expect-error Bare aliases must belong to this theme.
      theme.style({ '@media missing': { display: 'grid' } })
      // @ts-expect-error Root authoring has no aliases.
      style({ '@media tablet': { display: 'grid' } })
      // @ts-expect-error Nested property names remain exact.
      style({ ':hover': { colour: 'red' } })
      // @ts-expect-error Nested numeric lengths remain invalid.
      theme.style({ '@media tablet': { width: 10 } })
      // @ts-expect-error Nested token domains cannot cross properties.
      theme.style({ ':hover': { color: theme.tokens.spacing.gap } })
    })
  })
})

describe('dynamic', () => {
  describe('style', () => {
    test('checks numeric bindings only against their authored properties', () => {
      const indicator = style(
        (values: { alpha: number; width: `${number}%` }) => ({
          opacity: values.alpha,
          width: values.width,
          ':hover': { fillOpacity: values.alpha },
        }),
      )

      indicator({ alpha: 0.5, width: '50%' })
      // @ts-expect-error Arbitrary numbers cannot satisfy nonnegative flex factors.
      style((values: { grow: number }) => ({ flexGrow: values.grow }))
      // @ts-expect-error Numeric values cannot satisfy length properties.
      style((values: { width: number }) => ({ width: values.width }))
    })

    test('rejects constrained numbers and reserved runtime domains', () => {
      const bound = Theme.define({ color: { ink: 'red' } })

      // @ts-expect-error Bound callbacks reject reserved component fields too.
      bound.style((v: { ref: number }) => ({ opacity: v.ref }))
      // @ts-expect-error Bound callbacks reject unconstrained integer slots too.
      bound.style((v: { level: number }) => ({ zIndex: v.level }))
      // @ts-expect-error Arbitrary numbers cannot satisfy integer properties.
      style((v: { level: number }) => ({ zIndex: v.level }))
      // @ts-expect-error Component refs are not styling values.
      style((v: { ref: number }) => ({ opacity: v.ref }))
      // @ts-expect-error Importance belongs to declarations, not runtime values.
      style((v: { width: `${number}%!` }) => ({ width: v.width }))
    })
    test('checks static callback literals', () => {
      // @ts-expect-error Negative padding remains invalid in callbacks.
      style((v: { alpha: number }) => ({ opacity: v.alpha, padding: '-1px' }))

      const theme = Theme.define({ color: { ink: 'red' } })

      // @ts-expect-error Bound callbacks apply the same literal checks.
      theme.style((v: { alpha: number }) => ({
        opacity: v.alpha,
        padding: '-1px',
      }))
    })
    test('retains required input domains and styling overrides', () => {
      const bar = style((values: { amount: `${number}%`; alpha: number }) => ({
        width: values.amount,
        opacity: values.alpha,
        display: 'block',
      }))

      expectTypeOf(
        bar({ amount: '50%', alpha: 0.5 }),
      ).toEqualTypeOf<style.Props>()

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
      const themed = theme.style((values: { alpha: number }) => ({
        color: 'brand',
        opacity: values.alpha,
      }))

      themed({ alpha: 0.5 })
      // @ts-expect-error Dynamic bound values remain required.
      themed({})
      // @ts-expect-error Bound declarations keep property domains.
      theme.style((values: { width: number }) => ({ width: values.width }))
      // @ts-expect-error Dynamic CSS properties remain typed.
      style((values: { width: number }) => ({ width: values.width }))
    })
  })
})

describe('namedRules', () => {
  describe('style', () => {
    test('rejects identities from unrelated domains', () => {
      const dots = counterStyle({ symbols: '"x"' })
      const palette = fontPaletteValues({ fontFamily: 'Body', basePalette: 0 })
      const below = positionTry({ positionArea: 'bottom' })
      style({
        listStyleType: dots,
        fontPalette: palette,
        positionTryFallbacks: below,
      })
      // @ts-expect-error palette is not a counter
      style({ listStyleType: palette })
      // @ts-expect-error counter is not a palette
      style({ fontPalette: dots })
    })
  })
})

describe('selectors', () => {
  describe('style', () => {
    test('accepts strings and style-reference interpolation', () => {
      const card = style()
      const dynamic = style((values: { opacity: number }) => ({
        opacity: values.opacity,
      }))
      const config = Config.create({ theme: { color: { brand: '#06c' } } })
      const themed = config.style({ color: 'brand' })

      style({
        selectors: {
          '&:hover': { color: 'blue' },
          [`${card} > &`]: { color: 'blue' },
          [`&:has(${dynamic})`]: { opacity: 0.5 },
        },
      })
      config.style({ selectors: { [`${themed} + &`]: { color: 'brand' } } })
      style((values: { opacity: number }) => ({
        selectors: { [`${card}:hover &`]: { opacity: values.opacity } },
      }))

      // @ts-expect-error Nested values retain their CSS contracts.
      style({ selectors: { [`${card} &`]: { display: 'unknown-display' } } })
      // @ts-expect-error Nested properties remain exact.
      style({ selectors: { '&:hover': { colour: 'red' } } })
      // @ts-expect-error Root styles do not have configured tokens.
      style({ selectors: { '&:hover': { color: 'brand' } } })
      // @ts-expect-error Core definitions do not resolve compiler-owned selector groups.
      Style.define({ label: { selectors: { '&:hover': { color: 'red' } } } })
    })
  })
})
