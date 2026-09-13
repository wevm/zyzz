/** Checks the published opt-in theme's token and recipe inference. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { css, theme, tokens, variants } from 'zyzz/themes/default'

describe('variants', () => {
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
    css({ color: theme.tokens.color.blue[700], padding: 4 })
    expectTypeOf(tokens.breakpoints.md).toEqualTypeOf<'48rem'>()
    // @ts-expect-error Unknown bundled token.
    css({ color: 'missing' })
    // @ts-expect-error Choice remains finite through bound inference.
    button({ size: 'lg' })
  })
})
