/** Checks CSS registration defaults and scalar assignment contracts. @module */
import { describe, test } from 'vite-plus/test'
import { variable } from 'zyzz'

describe('variable', () => {
  test('registers independent defaults and retains assignment domains', () => {
    variable('length', { inherits: true, initialValue: '0' })
    variable('signedLength', { inherits: false, initialValue: '-1px' })
    const gap = variable('length', {
      inherits: true,
      initialValue: '4px',
      syntax: '<length>',
    })
    gap.set('8px')

    // @ts-expect-error Options require both registration fields.
    variable('color', { initialValue: 'red' })
    // @ts-expect-error Unknown registration options are rejected.
    variable('length', { inherits: true, initialValue: '4px', initial: '8px' })
    variable('length', {
      inherits: true,
      initialValue: '4px',
      // @ts-expect-error Syntax must match the variable domain.
      syntax: '<color>',
    })
    // @ts-expect-error Initial values must be computationally independent.
    variable('length', { inherits: false, initialValue: '1em' })
    // @ts-expect-error Unsigned defaults remain nonnegative.
    variable('length', { inherits: false, initialValue: '-1px' })
    // @ts-expect-error currentColor is not independent.
    variable('color', { inherits: false, initialValue: 'currentcolor' })
    variable('color', {
      inherits: false,
      // @ts-expect-error Nested currentColor is not independent.
      initialValue: 'color-mix(in srgb, currentColor, red)',
    })
    // @ts-expect-error Assignments retain their declared domain.
    gap.set('red')
  })
})
