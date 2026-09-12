/**
 * Measures type instantiations contributed by public variable contracts.
 * @module
 */
import { bench } from '@ark/attest'
import type * as Zyzz from 'zyzz'

// Type-only imports keep the fixture free of runtime module loading; attest
// analyzes bench bodies without executing them.
declare const css: typeof Zyzz.css
declare const Vars: typeof Zyzz.Vars

/** Resolves the shared authoring contracts before any bench body is measured. */
export function baseline() {
  Vars.define({ base: 'length' }).set({ base: '1px' })
}

bench('define / shorthand kinds', () => {
  const slots = Vars.define({
    amount: 'percentage',
    count: 'number',
    signed: 'signedLength',
    size: 'length',
  })

  slots.set({ amount: '50%', signed: '-12px', size: '12px' })
}).types([7260, 'instantiations'])

bench('define / registered descriptors', () => {
  Vars.define({
    amount: { inherits: false, initialValue: '0%', type: 'percentage' },
    gap: { inherits: true, initialValue: '4px', type: 'length' },
    offset: { inherits: false, initialValue: '-1px', type: 'signedLength' },
  })
}).types([2955, 'instantiations'])

bench('define / declaration references', () => {
  const slots = Vars.define({
    count: 'number',
    signed: 'signedLength',
    size: 'length',
  })

  css({ marginLeft: slots.signed, opacity: slots.count, padding: slots.size })
}).types([313768, 'instantiations'])
