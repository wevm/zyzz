/** Checks colorProfile through its public descriptor contract. @module */
import { describe, test, expectTypeOf } from 'vite-plus/test'
import { colorProfile } from 'zyzz/web'
describe('colorProfile', () => {
  test('preserves its descriptor and identity domains', () => {
    expectTypeOf(
      colorProfile({ src: 'url(/profile.icc)' }),
    ).toEqualTypeOf<colorProfile.Reference>()
  })
})
