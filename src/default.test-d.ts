/** Checks the published opt-in theme's token and recipe inference. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import {
  appearance,
  script,
  style,
  theme,
  tokens,
  variants,
} from 'zyzz/default'

describe('default', () => {
  test('exposes single-theme appearance controls and a server-safe script', () => {
    expectTypeOf(script()).toEqualTypeOf<string>()
    appearance.set({ colorScheme: 'dark' })
    expectTypeOf(appearance.get()).toEqualTypeOf<{
      readonly colorScheme?: 'dark' | 'light' | 'light dark' | undefined
    }>()
    // @ts-expect-error The default config has no named theme catalog.
    appearance.set({ theme: 'other' })
  })

  test('preserves bundled tokens, aliases, and payload selections', () => {
    const button = variants({
      conditions: { wide: '@media >=md' },
      base: { fontFamily: 'sans', color: 'foreground' },
      variants: {
        size: {
          sm: { padding: 4 },
          custom: (values: { padding: `${number}px` }) => ({
            padding: values.padding,
          }),
        },
      },
      defaultVariants: { size: 'sm' },
    })
    button({
      size: { custom: { padding: '12px' } },
      conditions: { wide: { size: null } },
    })
    style({ color: theme.tokens.color.blue[700], padding: 4 })
    expectTypeOf(tokens.breakpoints.md).toEqualTypeOf<'48rem'>()
    // @ts-expect-error Unknown bundled token.
    style({ color: 'missing' })
    // @ts-expect-error Choice remains finite through bound inference.
    button({ size: 'lg' })
  })
})
