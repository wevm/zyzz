/** Checks scoped dynamic recipe selection through the public authoring contract. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { variants } from 'zyzz'

describe('variants', () => {
  test('requires complete payloads and retains finite compound names', () => {
    const button = variants({
      conditions: { wide: '@media (width >= 600px)' },
      variants: {
        size: {
          sm: { padding: '4px' },
          custom: (values: { padding: `${number}px` }) => ({
            padding: values.padding,
          }),
          fluid: (values: { width: `${number}%` }) => ({ width: values.width }),
        },
      },
      defaultVariants: { size: { custom: { padding: '12px' } } },
      compoundVariants: [{ when: { size: 'custom' }, style: { color: 'red' } }],
    })
    button({
      size: { custom: { padding: '16px' } },
      conditions: { wide: { size: { custom: { padding: '24px' } } } },
    })
    button({ size: 'sm' })
    button({ size: null })
    expectTypeOf(button()).toHaveProperty('style')
    // @ts-expect-error Dynamic choices require payloads.
    button({ size: 'custom' })
    // @ts-expect-error Payload is incomplete.
    button({ size: { custom: {} } })
    // @ts-expect-error Payload domain is retained.
    button({ size: { custom: { padding: 'red' } } })
    // @ts-expect-error Exactly one dynamic choice per axis.
    button({ size: { custom: { padding: '1px' }, fluid: { width: '10%' } } })
  })
})
