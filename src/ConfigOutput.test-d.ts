/** Checks native renderer output through configured authoring. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Config } from 'zyzz'

describe('create', () => {
  test('selects HTML output for static and dynamic style applications', () => {
    const { css } = Config.create({ output: 'html' })

    const styles = {
      card: css({ padding: '8px' }),
      dynamic: css((values: { width: `${number}%` }) => ({
        width: values.width,
      })),
    }

    expectTypeOf(styles.card().class).toEqualTypeOf<string>()
    expectTypeOf(styles.dynamic({ width: '25%' }).style).toEqualTypeOf<
      string | undefined
    >()

    // @ts-expect-error HTML applications expose class, not className.
    void styles.card().className
    // @ts-expect-error CSS lengths require explicit units.
    styles.card({ style: { padding: 8 } })
    // @ts-expect-error Dynamic values preserve their declared units.
    styles.dynamic({ width: 25 })
    // @ts-expect-error Unsupported output targets are rejected.
    Config.create({ output: 'native' })
  })
  test('preserves the default React props contract', () => {
    const { css } = Config.create()
    const styles = { card: css({ padding: '8px' }) }

    expectTypeOf(styles.card().className).toEqualTypeOf<string>()

    // @ts-expect-error React applications retain className.
    void styles.card().class
  })
})
