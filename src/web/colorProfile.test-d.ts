/** Keeps the profile helper behind its browser verification gate. @module */
import { describe, test } from 'vite-plus/test'
import * as Web from 'zyzz/web'
describe('colorProfile', () => {
  test('remains planned until rendering is verified', () => {
    // @ts-expect-error colorProfile is not a public export yet
    Web.colorProfile({ src: 'url(/profile.icc)' })
  })
})
