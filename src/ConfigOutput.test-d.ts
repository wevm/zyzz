/** Checks native renderer output through configured authoring. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import * as Config from './internal/Configuration.js'

describe('create', () => {
  test('selects HTML output for static and dynamic style applications', () => {
    const { style, variants } = Config.create({ output: 'html' })

    const card = style({ padding: '8px' })
    const dynamic = style((values: { width: `${number}%` }) => ({
      width: values.width,
    }))
    const recipe = variants({
      variants: { size: { small: { padding: '8px' } } },
    })

    expectTypeOf(card().class).toEqualTypeOf<string>()
    expectTypeOf(dynamic({ width: '25%' }).style).toEqualTypeOf<
      string | undefined
    >()

    // @ts-expect-error HTML applications expose class, not className.
    void card().className
    // @ts-expect-error CSS lengths require explicit units.
    card({ style: { padding: 8 } })
    // @ts-expect-error Dynamic HTML overrides also require explicit units.
    dynamic({ style: { padding: 8 }, width: '25%' })
    // @ts-expect-error Recipe HTML overrides also require explicit units.
    recipe({ size: 'small', style: { padding: 8 } })
    // @ts-expect-error Dynamic values preserve their declared units.
    dynamic({ width: 25 })
    // @ts-expect-error Unsupported output targets are rejected.
    Config.create({ output: 'native' })
  })
  test('preserves the default React props contract', () => {
    const { style } = Config.create()
    const card = style({ padding: '8px' })

    expectTypeOf(card().className).toEqualTypeOf<string>()

    // @ts-expect-error React applications retain className.
    void card().class
  })
})
