/** Checks public viewTransition descriptor inference. @module */
import { describe, test } from 'vite-plus/test'
import { viewTransition } from 'zyzz/web'
describe('viewTransition', () => {
  test('accepts descriptor grammar and rejects context errors', () => {
    const options: viewTransition.Options = { navigation: 'auto' }
    viewTransition(options)
    viewTransition({ navigation: ' AUTO ', types: 'slide' })
    // @ts-expect-error navigation has a closed domain
    viewTransition({ navigation: 'always' })
  })
})
