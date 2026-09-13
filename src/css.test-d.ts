/**
 * Checks consumer inference and rejected inputs through the public css API.
 * @module
 */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Config, css, Theme, where } from 'zyzz'

describe('css', () => {
  test('accepts empty root, theme, and configured definitions', () => {
    const empty = css()
    const theme = Theme.define({})
    const config = Config.create({ theme: {} })
    const html = Config.create({ output: 'html', theme: {} })

    expectTypeOf(empty).toEqualTypeOf<css.ReturnType>()
    expectTypeOf(theme.css()).toEqualTypeOf<css.ReturnType>()
    expectTypeOf(config.css()).toEqualTypeOf<css.ReturnType>()
    expectTypeOf(html.css()).toEqualTypeOf<css.ReturnType<'html'>>()
    css({ [where`${empty} > &`]: { color: 'red' } })
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
