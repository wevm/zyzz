/**
 * Checks consumer inference and rejected inputs through the public Source API.
 * @module
 */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import type { Style } from 'zyzz'
import { Source } from 'zyzz/compiler'

describe('extract', () => {
  test('preserves extracted metadata and rejects invalid inputs', () => {
    const result = Source.extract({ moduleId: 'example/card.ts', source: '' })

    expectTypeOf(result.styles).toEqualTypeOf<Style.Definition>()
    expectTypeOf(result.calls).toEqualTypeOf<readonly Source.Call[]>()
    expectTypeOf(result.vars).toEqualTypeOf<
      Readonly<Record<string, import('../internal/Theme.js').Definition>>
    >()

    // @ts-expect-error Extracted scope maps are readonly.
    result.vars.extra = result.vars.existing!
    // @ts-expect-error A portable host module ID is required.
    Source.extract({ source: '' })
    // @ts-expect-error Call-site metadata is immutable.
    result.calls.push({ end: 1, name: 'card', start: 0 })
  })
})
