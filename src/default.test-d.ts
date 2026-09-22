/** Checks the published opt-in theme's token and recipe inference. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { appearance, script, style, vars, tokens, variants } from 'zyzz/default'

describe('default', () => {
  test('accepts Geist typography sets in styles and variants', () => {
    style({
      typography: 'heading.32',
      '@media >=md': { typography: 'heading.48' },
    })
    style({ typography: 'label.14.mono' })
    style({ typography: 'copy.14.strong' })
    style({ typography: 'heading.24.subtle' })
    variants({
      base: { typography: 'copy.14' },
      variants: { size: { large: { typography: 'copy.16' } } },
    })
    expectTypeOf(tokens.typography.heading[32].fontSize).toEqualTypeOf<'32px'>()
    // @ts-expect-error The bundled heading scale has no 30px set.
    style({ typography: 'heading.30' })
    // @ts-expect-error Typography is a single named set, not a fallback array.
    style({ typography: ['heading.32', 'copy.14'] })
  })

  test('exposes single-theme appearance controls and a server-safe script', () => {
    expectTypeOf(script()).toEqualTypeOf<string>()
    appearance.set({ colorScheme: 'dark' })
    expectTypeOf(appearance.get()).toEqualTypeOf<{
      readonly colorScheme?: 'dark' | 'light' | 'light dark' | undefined
    }>()
    // @ts-expect-error The default config has no named theme catalog.
    appearance.set({ set: 'other' })
  })

  test('preserves bundled tokens, aliases, and payload selections', () => {
    const button = variants({
      conditions: { wide: '@media >=md' },
      base: { fontFamily: 'sans', color: 'gray.950' },
      variants: {
        size: {
          sm: { padding: 4 },
          custom: (values: { padding: `${number}px` }) => ({
            padding: `${values.padding} !custom` as const,
          }),
        },
      },
      defaultVariants: { size: 'sm' },
    })
    button({
      size: { custom: { padding: '12px' } },
      conditions: { wide: { size: null } },
    })
    style({ color: vars.color.blue[700], padding: 4 })
    expectTypeOf(tokens.breakpoint.md).toEqualTypeOf<'48rem'>()
    // @ts-expect-error Unknown bundled token.
    style({ color: 'missing' })
    // @ts-expect-error Choice remains finite through bound inference.
    button({ size: 'lg' })
  })
})
