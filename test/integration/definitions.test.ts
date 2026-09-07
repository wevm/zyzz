import { Style } from 'typestyle'
import { describe, expect, test } from 'vite-plus/test'
import { components } from '../fixtures/components.js'

describe('consumer authoring through immutable definitions', () => {
  test('preserves named declarations and cascade-significant order across modules', () => {
    const definition = Style.define(components)
    expect(definition.styles.map((style) => style.name)).toEqual([
      'card',
      'label',
      'hidden',
    ])
    expect(definition.styles[0]?.declarations.slice(3, 6)).toEqual([
      { property: 'padding', value: '1rem' },
      { property: 'paddingLeft', value: 0 },
      { property: 'marginTop', value: '-2px' },
    ])
    expect(definition.styles[1]?.declarations).toContainEqual({
      property: 'lineHeight',
      value: 1.5,
    })
    expect(JSON.parse(JSON.stringify(definition))).toEqual(definition)
    expect(Style.define(components)).toEqual(definition)
  })

  test('copies input and freezes the entire public data graph', () => {
    const input = { card: { padding: '1rem' as const } }
    const definition = Style.define(input)
    Object.assign(input.card, { padding: '9rem' })
    expect(definition.styles[0]?.declarations[0]?.value).toBe('1rem')
    const objects = [
      definition,
      definition.styles,
      definition.styles[0],
      definition.styles[0]?.declarations,
      definition.styles[0]?.declarations[0],
    ]
    for (const object of objects) expect(Object.isFrozen(object)).toBe(true)
    expect(Reflect.set(definition.styles, '0', {})).toBe(false)
  })

  test('reports multiple consumer errors with exact paths and optional source spans', () => {
    const location = {
      path: ['card', 'padding'],
      source: 'consumer.ts',
      start: 10,
      end: 11,
    }
    const input: unknown = {
      card: { padding: 4, colour: 'red', opacity: Infinity },
      'other.card': { ':hover': {} },
    }
    let failure: unknown
    try {
      // @ts-expect-error Exercise a genuinely untyped caller at the public boundary.
      Style.define(input, { locations: [location] })
    } catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(Style.InvalidError)
    if (!(failure instanceof Style.InvalidError)) throw failure
    expect(failure.name).toBe('Style.InvalidError')
    expect(
      failure.diagnostics.map(({ code, path }) => ({ code, path })),
    ).toEqual([
      { code: 'invalid_value', path: ['card', 'padding'] },
      { code: 'unsupported_property', path: ['card', 'colour'] },
      { code: 'invalid_value', path: ['card', 'opacity'] },
      { code: 'unsupported_property', path: ['other.card', ':hover'] },
    ])
    expect(failure.diagnostics[0]?.location).toEqual(location)
    expect(failure.diagnostics[1]?.location).toBeUndefined()
    location.path[0] = 'changed'
    expect(failure.diagnostics[0]?.location?.path).toEqual(['card', 'padding'])
    expect(Object.isFrozen(failure.diagnostics[0]?.path)).toBe(true)
  })

  test('rejects executable and non-data inputs without invoking accessors', () => {
    let reads = 0
    const input: unknown = {
      card: {
        get padding() {
          reads++
          return '1rem'
        },
      },
    }
    // @ts-expect-error Untyped data must pass runtime validation.
    expect(() => Style.define(input)).toThrow(Style.InvalidError)
    expect(reads).toBe(0)
    for (const invalid of [
      null,
      [],
      () => ({}),
      new Date(),
      { card: null },
      { card: { [Symbol('color')]: '#fff' } },
    ]) {
      // @ts-expect-error Untyped data must pass runtime validation.
      expect(() => Style.define(invalid)).toThrow(Style.InvalidError)
    }
  })

  test('accepts empty definitions and null-prototype data without interpreting style names', () => {
    expect(Style.define({})).toEqual({ styles: [] })
    expect(Style.define({ empty: {} })).toEqual({
      styles: [{ name: 'empty', declarations: [] }],
    })
    const input = Object.assign(
      Object.create(null) as Record<string, Style.Properties>,
      {
        constructor: { color: '#abcdef' as const },
        toString: { margin: 'auto' as const },
      },
    )
    expect(Style.define(input).styles.map(({ name }) => name)).toEqual([
      'constructor',
      'toString',
    ])
  })

  test('validates supported value domains before returning any definition', () => {
    const accepted = Style.define({
      card: {
        padding: '1e2px',
        margin: '-0.5rem',
        width: '50%',
        color: '#ABCDEF80',
        opacity: 0,
        fontWeight: 1000,
        display: 'revert-layer',
      },
    })
    expect(accepted.styles[0]?.declarations).toHaveLength(7)
    const invalid: readonly unknown[] = [
      { padding: '-1px' },
      { padding: '1.px' },
      { padding: '1e999px' },
      { borderWidth: '10%' },
      { opacity: NaN },
      { opacity: 2 },
      { color: '#abcdz' },
      { color: 'blue.700' },
      { fontWeight: 0 },
      { padding: undefined },
      { display: ['block', 'grid'] },
      { color: '#fff!' },
      { width: 'calc(100% - 1rem)' },
      { padding: { token: 'sm' } },
    ]
    for (const value of invalid) {
      // @ts-expect-error Unsupported values from external consumers fail at runtime.
      expect(() => Style.define({ card: value })).toThrow(Style.InvalidError)
    }
  })
})
