/** Checks scoped dynamic recipe selection through the public authoring contract. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { variants } from 'zyzz'

describe('variants', () => {
  test('rejects static alternatives inside bound payload objects', () => {
    const button = variants({
      variants: {
        size: {
          sm: { padding: '4px' },
          custom: (values: { padding: `${number}px` }) => ({
            padding: values.padding,
          }),
        },
      },
    })
    const selection = { sm: true, custom: { padding: '16px' as const } }
    // @ts-expect-error A payload object must exclude every other declared choice.
    button({ size: selection })
  })
  test('rejects infinite payload fields', () => {
    variants({
      variants: {
        size: {
          // @ts-expect-error Payload field names must be finite.
          custom: (values: { padding: string; [field: string]: string }) => ({
            padding: values.padding,
          }),
        },
      },
    })
  })

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
