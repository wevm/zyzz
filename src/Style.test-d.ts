import { expectTypeOf } from 'vitest'
import { css, type Style } from './index.js'

expectTypeOf(css).returns.toEqualTypeOf<string>()
css({
  padding: 4,
  marginInline: 'auto',
  color: 'blue.900',
  typography: 'heading.32',
  borderRadius: 'lg',
  display: 'grid',
  '@md': { gap: 6 },
  ':hover': { backgroundColor: 'gray.200' },
  '&[data-checked]': { opacity: 1 },
})
css({
  width: '[calc(100% - 2rem)]',
  color: '[var(--brand)]',
  padding: undefined,
})
const style = { padding: 4, color: 'gray.1000' } satisfies Style
expectTypeOf(style.color).toEqualTypeOf<'gray.1000'>()
// @ts-expect-error A typo is not a CSS property.
css({ paddding: 4 })
// @ts-expect-error Colors require a valid step.
css({ color: 'blue.123' })
// @ts-expect-error Radius tokens cannot be used as colors.
css({ color: 'lg' })
// @ts-expect-error CSS keyword unions cannot widen to arbitrary strings.
css({ display: 'banana' })
// @ts-expect-error Spacing is a numeric token or explicit escape.
css({ padding: '4px' })
// @ts-expect-error Invalid nested tokens are rejected.
css({ ':hover': { borderRadius: 'big' } })
// @ts-expect-error Invalid breakpoints are rejected.
css({ '@tablet': { padding: 4 } })
// @ts-expect-error Invalid typography presets are rejected.
css({ typography: 'copy.99' })
// @ts-expect-error No arbitrary numeric radius values.
css({ borderRadius: 8 })
