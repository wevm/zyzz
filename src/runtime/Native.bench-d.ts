/** Measures native callable and composition inference with caller-owned values. @module */
import { bench } from '@ark/attest'
import type * as Runtime from 'zyzz/runtime'

declare const Native: typeof Runtime.Native
declare const dynamic: Runtime.NativeDynamic.Callable<{ alpha: number }>
declare const value: { readonly current: number }

/** Warms the finite native table contract. */
export function baseline() {
  Native.create({ axes: {}, defaults: {}, styles: { 0: { opacity: 0.5 } } })
}

bench('native / caller-owned values and composition', () => {
  const card = Native.create({
    axes: { size: ['small', 'large'] },
    defaults: { size: 'small' },
    styles: { 0: { padding: 4 }, 1: { padding: 8 }, 2: {} },
  })
  const override = { opacity: value, transform: [{ translateX: value }] }
  Native.compose(
    card({ size: 'large', style: [false, [override]] }),
    dynamic({ alpha: 0.5, style: override }),
    false,
    card(),
  )
}).types([440, 'instantiations'])
