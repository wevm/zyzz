/** Checks public viewTransition descriptor inference. @module */
import { describe, test } from 'vite-plus/test'
import { viewTransition } from 'zyzz/web'
describe('viewTransition', () => {
  test('accepts descriptor grammar and rejects context errors', () => {
    const options: viewTransition.Options = { navigation: 'auto' }
    viewTransition(options)
    viewTransition({ navigation: ' AUTO ', types: 'slide' })
    viewTransition({ navigation: '\\61 uto', types: 'none' })
    viewTransition({ types: '\\73 lide 图' })
    // @ts-expect-error none is standalone
    viewTransition({ types: 'none slide' })
    // @ts-expect-error CSS-wide keywords are not descriptor values
    viewTransition({ types: 'inherit' })
    // @ts-expect-error transition types are space-separated identifiers
    viewTransition({ types: 'slide,forwards' })
    // @ts-expect-error types are identifiers, not numbers
    viewTransition({ types: 1 })
    // @ts-expect-error page rules cannot enclose transitions
    viewTransition({ '@page': { navigation: 'auto' } })

    // @ts-expect-error navigation has a closed domain
    viewTransition({ navigation: 'always' })
  })
})

describe('viewTransition', () => {
  test('covers descriptor inventory and context errors', () => {
    viewTransition({ navigation: 'auto', types: 'slide forwards' })
  })
})

describe('viewTransition', () => {
  test('accepts nested group keys and rejects legacy contexts', () => {
    viewTransition({
      '@layer definitions': { '@media screen': { navigation: 'auto' } },
    })
    // @ts-expect-error selectors cannot enclose a declaration
    viewTransition({ '.card': { navigation: 'auto' } })
    // @ts-expect-error enclosing groups belong in the definition
    viewTransition({ navigation: 'auto' }, { within: ['@layer definitions'] })
  })
})
