import { expectTypeOf } from 'vite-plus/test'
import { css } from 'zyzz'

const card = css({ color: '#fff', padding: '1rem' })
expectTypeOf(card).toEqualTypeOf<css.ReturnType>()
expectTypeOf(
  card({ className: 'external', style: { opacity: 0.5 } }),
).toEqualTypeOf<css.Props>()
// @ts-expect-error Unknown properties cannot hide in aliased objects.
css({ colour: '#fff' })
// @ts-expect-error Root calls contain no spacing tokens.
css({ padding: 4 })
// @ts-expect-error Root calls contain no color tokens.
css({ color: 'blue.700' })
// @ts-expect-error Callbacks require the later dynamic binding phase.
css(() => ({ padding: 0 }))
// @ts-expect-error Unrelated component props are not styling overrides.
card({ id: 'card' })
declare const union: { color: '#fff' } | { colour: '#fff'; color: '#fff' }
// @ts-expect-error Unknown keys in a union branch are rejected.
css(union)
