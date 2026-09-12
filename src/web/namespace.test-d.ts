/** Checks namespace authoring options and module-effect return types through the public entrypoint. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { namespace } from 'zyzz/web'

describe('namespace', () => {
  test('accepts CSS identifier spellings, default namespaces, and empty names', () => {
    expectTypeOf(
      namespace({ prefix: '图', uri: 'urn:shapes' }),
    ).toEqualTypeOf<void>()
    namespace({ prefix: '\\73 vg', uri: 'http://www.w3.org/2000/svg' })
    namespace({ prefix: '--', uri: '' })
    namespace({ uri: '' })
    namespace({ prefix: undefined, uri: 'urn:default' })
    // @ts-expect-error Namespace names are strings, not fetched URL objects.
    namespace({ uri: new URL('https://example.com') })
    // @ts-expect-error Namespace prefixes cannot be numeric.
    namespace({ prefix: 1, uri: 'urn:shapes' })
    // @ts-expect-error Namespace declarations have no conditional contexts.
    namespace({ uri: 'urn:shapes', within: ['@media print'] })
  })
})
