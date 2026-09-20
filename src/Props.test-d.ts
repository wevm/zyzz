/** Verifies inferred component props through the public entrypoint. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { type Props, variants } from 'zyzz'
import * as Theme from './internal/Theme.js'

describe('Props.Variants', () => {
  test('preserves selections and styling overrides', () => {
    const button = variants({
      defaultVariants: { size: 'sm' },
      variants: {
        loading: { true: { opacity: 0.5 }, false: {} },
        size: { sm: { padding: '4px' }, lg: { padding: '12px' } },
      },
    })

    type Input = Props.Variants<typeof button>
    expectTypeOf<Input['size']>().toEqualTypeOf<
      'sm' | 'lg' | null | undefined
    >()
    expectTypeOf<Input['loading']>().toEqualTypeOf<boolean | null | undefined>()
    const input: Input = { className: 'external', loading: true, size: null }
    button(input)
    const defaults: Input = {}
    button(defaults)

    // @ts-expect-error The extracted props exclude undefined.
    const absent: Input = undefined
    // @ts-expect-error The extracted props exclude null.
    const empty: Input = null
    // @ts-expect-error Unknown choices remain invalid.
    const invalid: Input = { size: 'huge' }
    void [absent, empty, invalid]
  })

  test('preserves theme-bound conditions and dynamic payloads', () => {
    const theme = Theme.define({ color: { brand: '#06c' } })
    const button = theme.variants({
      conditions: { wide: '@media (width >= 600px)' },
      variants: {
        size: {
          sm: { color: 'brand' },
          custom: (values: { padding: `${number}px` }) => ({
            padding: values.padding,
          }),
        },
      },
    })

    type Input = Props.Variants<typeof button>
    const input: Input = {
      conditions: { wide: { size: { custom: { padding: '24px' } } } },
      size: { custom: { padding: '12px' } },
    }
    button(input)

    // @ts-expect-error Dynamic choices require complete payloads.
    const invalid: Input = { size: { custom: {} } }
    // @ts-expect-error Conditions must be declared.
    const unknown: Input = { conditions: { narrow: { size: 'sm' } } }
    void [invalid, unknown]
  })

  test('requires a callable definition', () => {
    // @ts-expect-error Definitions must be callable.
    type Invalid = Props.Variants<{ size: 'sm' }>
    expectTypeOf<Invalid>().toBeNever()
  })
})
