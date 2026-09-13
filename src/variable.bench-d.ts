/**
 * Measures type instantiations contributed by public variable contracts.
 * @module
 */
import { bench } from '@ark/attest'
import type * as Zyzz from 'zyzz'

// Type-only imports keep the fixture free of runtime module loading; attest
// analyzes bench bodies without executing them.
declare const css: typeof Zyzz.css
declare const variable: typeof Zyzz.variable

/** Resolves the shared authoring contracts before any bench body is measured. */
export function baseline() {
  void { ...{ base: variable('length') }['base'].set('1px') }
}

bench('define / shorthand kinds', () => {
  const slots = {
    amount: variable('percentage'),
    count: variable('number'),
    signed: variable('signedLength'),
    size: variable('length'),
  }

  void {
    ...slots['amount'].set('50%'),
    ...slots['signed'].set('-12px'),
    ...slots['size'].set('12px'),
  }
}).types([2633, 'instantiations'])

bench('define / registered descriptors', () => {
  void {
    amount: variable('percentage', { inherits: false, initialValue: '0%' }),
    gap: variable('length', { inherits: true, initialValue: '4px' }),
    offset: variable('signedLength', { inherits: false, initialValue: '-1px' }),
  }
}).types([29379, 'instantiations'])

bench('define / declaration references', () => {
  const slots = {
    count: variable('number'),
    signed: variable('signedLength'),
    size: variable('length'),
  }

  css({ marginLeft: slots.signed, opacity: slots.count, padding: slots.size })
}).types([313838, 'instantiations'])
