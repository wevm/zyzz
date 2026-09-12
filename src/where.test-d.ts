/** Checks style-reference interpolation and nested declaration inference. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Config, css, where } from 'zyzz'

describe('where', () => {
  test('accepts static, configured, empty, and dynamic definitions', () => {
    const card = css({})
    const dynamic = css((values: { opacity: number }) => ({
      opacity: values.opacity,
    }))
    const config = Config.create({ theme: { color: { brand: '#06c' } } })
    const themed = config.css({ color: 'brand' })

    css({ [where`${card} > &`]: { color: 'blue' } })
    config.css({ [where`${themed} + &`]: { color: 'brand' } })
    css({ [where`&:has(${dynamic})`]: { opacity: 0.5 } })
    expectTypeOf(card).toExtend<where.Reference>()
    expectTypeOf(dynamic).toExtend<where.Reference>()
  })

  test('rejects props, arbitrary functions, strings, and invalid values', () => {
    const card = css({})
    // @ts-expect-error Applied props do not identify a definition.
    where`${card()} &`
    // @ts-expect-error Arbitrary functions are not css definitions.
    where`${() => ({ className: 'card' })} &`
    // @ts-expect-error Interpolations are style identities, not selector strings.
    where`${'.card'} &`
    // @ts-expect-error Nested declarations retain their CSS value contracts.
    css({ [where`${card} &`]: { display: 'unknown-display' } })
  })
})
