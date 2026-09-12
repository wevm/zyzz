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
  test('accepts scalar numbers through repeated alternatives', () => {
    const comma = cssFunction({
      parameters: [{ name: '--x', syntax: 'type(<integer> | <number>#)' }],
      body: { result: 'var(--x)' },
    })
    const space = cssFunction({
      parameters: [{ name: '--x', syntax: 'type(<integer> | <number>+)' }],
      body: { result: 'var(--x)' },
    })
    const number = cssFunction({
      parameters: [{ name: '--x', syntax: '<number>#' }],
      body: { result: 'var(--x)' },
    })
    const integer = cssFunction({
      parameters: [{ name: '--x', syntax: '<integer>+' }],
      body: { result: 'var(--x)' },
    })

    comma(1.5)
    comma('1.5, 2')
    space(1.5)
    space('1.5 2')
    number(1.5)
    integer(2)
    integer('1 2')
    // @ts-expect-error repeated integer alternatives still require integer scalar tokens
    integer(1.5)
  })

  test('keeps image returns out of URL-only properties', () => {
    const image = cssFunction({
      parameters: [],
      returns: '<image>',
      body: { result: 'linear-gradient(red, blue)' },
    })
    const url = cssFunction({
      parameters: [],
      returns: '<url>',
      body: { result: 'url(/clip.svg)' },
    })

    css({ backgroundImage: image(), clipPath: url() })
    // @ts-expect-error an image may be a gradient, which clip-path cannot accept
    css({ clipPath: image() })
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

  test('keeps unbounded results out of bounded property slots', () => {
    const lengths = cssFunction({
      parameters: [],
      returns: '<length>+',
      body: { result: '1px 2px 3px 4px 5px' },
    })
    const images = cssFunction({
      parameters: [],
      returns: '<image>#',
      body: { result: 'url(/a.svg), linear-gradient(red, blue)' },
    })

    css({ backgroundImage: images() })
    css({ '--lengths': lengths() })
    // @ts-expect-error margin permits at most four values, whereas + is unbounded
    css({ margin: lengths() })
    // @ts-expect-error a scalar dimension cannot consume a list result
    css({ width: lengths() })
    // @ts-expect-error clip-path accepts neither image gradients nor comma lists
    css({ clipPath: images() })
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
