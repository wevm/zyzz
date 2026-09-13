/** Verifies recipe inference and rejected authoring through the public entrypoint. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { variants } from 'zyzz'

describe('variants', () => {
  test('infers choices, booleans, null, defaults, compounds, and overrides', () => {
    const button = variants({
      base: { display: 'inline-flex' },
      variants: {
        size: { sm: { padding: '4px' }, lg: { padding: '12px' } },
        loading: { true: { opacity: 0.5 }, false: {} },
      },
      defaultVariants: { size: 'sm', loading: false },
      compoundVariants: [
        {
          when: { size: ['sm', 'lg'], loading: true },
          style: { color: 'red' },
        },
      ],
    })

    type Input = NonNullable<Parameters<typeof button>[0]>
    expectTypeOf<Input['size']>().toEqualTypeOf<
      'sm' | 'lg' | null | undefined
    >()
    expectTypeOf<Input['loading']>().toEqualTypeOf<boolean | null | undefined>()
    const extra = { size: 'sm', disabled: true } as const
    // @ts-expect-error Extra keys remain invalid through bindings.
    button(extra)
    // @ts-expect-error Only declared data attributes exist.
    void button()['data-typo']
    button()
    button({
      size: null,
      loading: undefined,
      className: 'external',
      style: { opacity: 1 },
      variables: { '--progress': 0.5 },
    })

    // @ts-expect-error Unknown choice.
    button({ size: 'huge' })
    // @ts-expect-error Component props are not recipe selections.
    button({ disabled: true })
    // @ts-expect-error Boolean axes take booleans.
    button({ loading: 'true' })
  })

  test('rejects invalid properties and recipe structure', () => {
    // @ts-expect-error Recipes have one element, without slots.
    variants({ slots: { root: {} } })
    // @ts-expect-error Unknown CSS property in the base.
    variants({ base: { colro: 'red' } })
    // @ts-expect-error Invalid CSS value in a choice.
    variants({ variants: { size: { small: { display: 'invalid' } } } })
    // @ts-expect-error Styling props are reserved axis names.
    variants({ variants: { style: { small: {} } } })
    variants({
      variants: { size: { small: {} } },
      // @ts-expect-error Defaults must name a defined choice.
      defaultVariants: { size: 'large' },
    })
    variants({
      variants: { size: { small: {} } },
      // @ts-expect-error Default axes must be defined.
      defaultVariants: { missing: 'small' },
    })
    variants({
      variants: { size: { small: {} } },
      compoundVariants: [
        // @ts-expect-error Compound styles retain value checking.
        { when: { size: 'small' }, style: { display: 'invalid' } },
      ],
    })
    variants({
      variants: { size: { small: {} } },
      // @ts-expect-error Compound axes must be defined.
      compoundVariants: [{ when: { missing: 'small' }, style: {} }],
    })
  })
})
