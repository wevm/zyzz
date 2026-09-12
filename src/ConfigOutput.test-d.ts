/** Checks native renderer output through configured authoring. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Config } from 'zyzz'

describe('create', () => {
  test('selects HTML output for static and dynamic style applications', () => {
    const { css } = Config.create({ output: 'html' })

    const card = css({ padding: '8px' })
    const dynamic = css((values: { width: `${number}%` }) => ({
      width: values.width,
    }))

    expectTypeOf(card().class).toEqualTypeOf<string>()
    expectTypeOf(dynamic({ width: '25%' }).style).toEqualTypeOf<
      string | undefined
    >()

    // @ts-expect-error HTML applications expose class, not className.
    void card().className
    // @ts-expect-error CSS lengths require explicit units.
    card({ style: { padding: 8 } })
    // @ts-expect-error Dynamic values preserve their declared units.
    dynamic({ width: 25 })
    // @ts-expect-error Unsupported output targets are rejected.
    Config.create({ output: 'native' })
  })
  test('preserves the default React props contract', () => {
    const { css } = Config.create()
    const card = css({ padding: '8px' })

    expectTypeOf(card().className).toEqualTypeOf<string>()

    // @ts-expect-error React applications retain className.
    void card().class
  })
})
