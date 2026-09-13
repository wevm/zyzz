/** Checks finite conditional recipe selection through public and generated contracts. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Config, variants } from 'zyzz'

describe('variants', () => {
  test('retains condition names, axes, booleans, and nullable choices', () => {
    const button = variants({
      conditions: {
        wide: '@media (width >= 600px)',
        grid: '@supports (display: grid)',
      },
      variants: { size: { sm: {}, lg: {} }, loading: { true: {}, false: {} } },
      defaultVariants: { size: 'sm' },
    })
    button({
      size: 'sm',
      conditions: {
        wide: { size: 'lg', loading: false },
        grid: { size: null, loading: undefined },
      },
    })
    button({ conditions: { wide: undefined } })
    button({ conditions: undefined })
    expectTypeOf(button()).toHaveProperty('className')
    // @ts-expect-error Unknown condition.
    button({ conditions: { missing: { size: 'lg' } } })
    // @ts-expect-error Unknown axis.
    button({ conditions: { wide: { intent: 'primary' } } })
    // @ts-expect-error Unknown finite choice.
    button({ conditions: { wide: { size: 'xl' } } })
    // @ts-expect-error Scoped selection does not accept styling overrides.
    button({ conditions: { wide: { style: { color: 'red' } } } })
    // @ts-expect-error Unsupported condition target.
    variants({ conditions: { wide: '@container (width > 1px)' } })
    // @ts-expect-error Reserved input property.
    variants({ variants: { conditions: { sm: {} } } })
    // @ts-expect-error Reserved attribute namespace.
    variants({ variants: { 'zyzz-condition-0-size': { sm: {} } } })
  })

  test('retains bound query aliases and HTML props', () => {
    const { variants: recipe } = Config.create({
      output: 'html',
      theme: { breakpoints: { md: '600px' } },
    })
    const button = recipe({
      conditions: { wide: '@media >=md' },
      variants: { size: { sm: {}, lg: {} } },
    })
    expectTypeOf(
      button({ conditions: { wide: { size: 'lg' } } }),
    ).toHaveProperty('class')
    // @ts-expect-error Query alias belongs to the bound theme.
    recipe({ conditions: { wide: '@media >=missing' } })
    // @ts-expect-error Root recipes have no named thresholds.
    variants({ conditions: { wide: '@media >=md' } })
  })

  test('preserves condition names in the transformed declaration shape', () => {
    type Compiled = variants.ReturnType<{
      conditions: { wide: unknown }
      variants: { size: { sm: {}; lg: {} } }
    }>
    expectTypeOf<
      NonNullable<Parameters<Compiled>[0]>['conditions']
    >().toEqualTypeOf<
      | {
          readonly wide?:
            | { readonly size?: 'sm' | 'lg' | null | undefined }
            | undefined
        }
      | undefined
    >()
  })
})
