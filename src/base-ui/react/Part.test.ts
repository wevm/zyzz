/** Exercises declared part validation through the opt-in public entrypoint. @module */
import { describe, expect, test } from 'vite-plus/test'
import { part } from 'zyzz/base-ui/react'

describe('part', () => {
  test('returns the same component and rejects invalid descriptors', () => {
    const component = () => null

    expect(
      part(component, { open: 'boolean', status: ['done'] }) === component,
    ).toMatchInlineSnapshot(`true`)
    expect(Object.keys(component)).toMatchInlineSnapshot(`[]`)
    expect(() =>
      part(() => null, { 'data-open': 'boolean' }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Style.InvalidError: ["data-open"]: Invalid part state: data-open.]`,
    )
    expect(() =>
      part(() => null, { Open: 'boolean' }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Style.InvalidError: ["Open"]: Invalid part state: Open.]`,
    )
    expect(() =>
      part(() => null, { status: [] as never }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Style.InvalidError: ["status"]: Invalid part state: status.]`,
    )
    expect(() =>
      part(() => null, { status: ['a\0b'] }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Style.InvalidError: ["status"]: Invalid part state: status.]`,
    )
    expect(() =>
      part('div' as never, { open: 'boolean' }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Style.InvalidError: []: Parts require a component object or function.]`,
    )
  })
})
