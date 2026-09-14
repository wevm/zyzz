/**
 * Checks consumer inference and rejected inputs through the public Css API.
 * @module
 */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Style } from 'zyzz'
import { Css } from 'zyzz/web'

describe('compile', () => {
  test('accepts explicit CSS representations', () => {
    const styles = Style.define({ card: { color: 'red' } })
    for (const cssOutput of ['atomic', 'grouped'] as const) {
      const output = Css.compile({ cssOutput, styles })
      expectTypeOf(output.classes.card).toEqualTypeOf<string>()
    }
    // @ts-expect-error Output mode is a closed union.
    Css.compile({ cssOutput: 'automatic', styles })
  })

  test('preserves class names and validates composition options', () => {
    const result = Css.compile({
      styles: Style.define({ card: { padding: 0 } }),
    })

    expectTypeOf(result.classes.card).toEqualTypeOf<string>()

    expectTypeOf<keyof typeof result.classes>().toEqualTypeOf<'card'>()

    expectTypeOf(result.css).toEqualTypeOf<string>()
    // @ts-expect-error Unknown style names remain rejected.
    expectTypeOf(result.classes.missing)

    // @ts-expect-error Results are readonly.
    result.classes.card = 'changed'
    Css.compile({ styles: Style.define({}), themes: {} })

    const independent = Css.compile({
      composition: 'independent',
      styles: Style.define({ card: { padding: 0 } }),
    })

    expectTypeOf<keyof typeof independent.classes>().toEqualTypeOf<'card'>()
    // @ts-expect-error Compilation requires an explicit supported composition contract.
    Css.compile({ composition: 'automatic', styles: Style.define({}) })
  })
})
