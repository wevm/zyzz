/** Verifies scalar parameter domains through the public CSS function helper. @module */
import { describe, test } from 'vite-plus/test'
import { css } from 'zyzz'
import { cssFunction } from 'zyzz/web'
describe('cssFunction', () => {
  test('rejects fractional integer arguments', () => {
    const fn = cssFunction({
      parameters: [{ name: '--n', syntax: '<integer>' }],
      body: { result: 1 },
    })
    fn(2)
    // @ts-expect-error integer parameters reject fractional literals
    fn(1.5)
  })
  test('checks every supported scalar parameter syntax', () => {
    const fn = cssFunction({
      parameters: [
        { name: '--c', syntax: '<color>' },
        { name: '--l', syntax: '<length>' },
        { name: '--p', syntax: '<length-percentage>' },
        { name: '--a', syntax: '<angle>' },
        { name: '--t', syntax: '<time>' },
      ],
      body: { result: 1 },
    })
    fn('red', '1pc', '2%', '1turn', '20ms')
    // @ts-expect-error colors reject lengths
    fn('1px', '1pc', '2%', '1turn', '20ms')
    // @ts-expect-error lengths exclude percentages
    fn('red', '1%', '2%', '1turn', '20ms')
    // @ts-expect-error length-percentage rejects color keywords
    fn('red', '1pc', 'red', '1turn', '20ms')
    // @ts-expect-error angles require angular units
    fn('red', '1pc', '2%', '1px', '20ms')
    // @ts-expect-error times require time units
    fn('red', '1pc', '2%', '1turn', 'red')
  })
})

describe('cssFunction', () => {
  test('infers composite domains and rejects invalid signatures', () => {
    const size = cssFunction({
      parameters: [{ name: '--x', syntax: 'type(<length> | <percentage>)' }],
      returns: 'type(<length> | <percentage>)',
      body: { result: 'var(--x)' },
    })
    size('1px')
    size('25%')
    // @ts-expect-error angles do not belong to the parameter alternatives
    size('1deg')
    // @ts-expect-error booleans are not CSS values
    size(true)
    css({ width: size('1px') })
    // @ts-expect-error every returned alternative must belong to the property domain
    css({ color: size('1px') })
    const invalid = {
      parameters: [],
      returns: 'type(<length> && <color>)',
      body: { result: 0 },
    } as const
    // @ts-expect-error unsupported syntax combinator
    cssFunction(invalid)
    const incomplete = {
      parameters: [],
      returns: 'type(<length> |)',
      body: { result: 0 },
    } as const
    // @ts-expect-error a trailing alternative is incomplete
    cssFunction(incomplete)
    const unwrapped = {
      parameters: [],
      returns: '<length> | <percentage>',
      body: { result: 0 },
    } as const
    // @ts-expect-error alternatives require type()
    cssFunction(unwrapped)
    const integer = cssFunction({
      parameters: [{ name: '--x', syntax: 'type(<integer> | <percentage>)' }],
      body: { result: 1 },
    })
    integer(1)
    integer('25%')
    // @ts-expect-error numeric alternatives require an integer token
    integer(1.5)
  })
})
