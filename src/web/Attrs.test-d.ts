/** Checks compiled props consumption through public renderer contracts. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { css } from 'zyzz'
import { Attrs } from 'zyzz/web'

describe('from', () => {
  test('accepts applied styles and preserves DOM output types', () => {
    const styles = { card: css({ padding: '8px' }) }
    const attributes = Attrs.from(styles.card())
    expectTypeOf(attributes.class).toEqualTypeOf<string>()
    expectTypeOf(attributes.style).toEqualTypeOf<string | undefined>()
    // @ts-expect-error Apply the style before converting its props.
    Attrs.from(styles.card)
    // @ts-expect-error Inline lengths require explicit units.
    Attrs.from({ className: 'card', style: { padding: 8 } })
  })
})

describe('serialize', () => {
  test('accepts converted styling attributes', () => {
    expectTypeOf(
      Attrs.serialize({ class: 'card', style: 'padding:8px' }),
    ).toEqualTypeOf<string>()
    // @ts-expect-error Serialization consumes DOM attributes, not React props.
    Attrs.serialize({ className: 'card' })
  })
})
