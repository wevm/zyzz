/** Verifies native registration syntax and required initial descriptors. @module */
import { describe, test } from 'vite-plus/test'
import { property } from 'zyzz/web'

describe('property', () => {
  test('accepts native syntax alternatives lists and universal registration', () => {
    property({
      name: '--size',
      syntax: '<length> | auto',
      inherits: false,
      initialValue: '1px',
    })
    property({
      name: '--colors',
      syntax: '<color>#',
      inherits: true,
      initialValue: 'red,blue',
    })
    property({ name: '--any', syntax: '*', inherits: false })
    property({
      name: '--word',
      syntax: '日本語',
      inherits: false,
      initialValue: '日本語',
    })
    // @ts-expect-error typed registrations require an initial value
    property({ name: '--missing', syntax: '<length>', inherits: false })
    property({
      name: '--wrong',
      // @ts-expect-error syntax-definition combinators are restricted
      syntax: '<length> && <color>',
      inherits: false,
      initialValue: '1px red',
    })
    // @ts-expect-error property names use the custom-property domain
    property({ name: 'wrong', syntax: '*', inherits: false })
    // @ts-expect-error unknown descriptor
    property({ name: '--wrong', syntax: '*', inherits: false, unknown: true })
  })
})

describe('property', () => {
  test('accepts nested group keys and rejects legacy contexts', () => {
    property({
      '@layer definitions': {
        '@media screen': {
          name: '--size',
          syntax: '<length>',
          inherits: false,
          initialValue: '1px',
        },
      },
    })
    // @ts-expect-error selectors cannot enclose a declaration
    property({
      '.card': {
        name: '--size',
        syntax: '<length>',
        inherits: false,
        initialValue: '1px',
      },
    })
    property(
      {
        name: '--size',
        syntax: '<length>',
        inherits: false,
        initialValue: '1px',
      },
      // @ts-expect-error enclosing groups belong in the definition
      { within: ['@layer definitions'] },
    )
  })
})
