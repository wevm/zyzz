/** Checks target-specific Babel options and typed stylesheet metadata. @module */
import type * as Babel from '@babel/core'
import { describe, expectTypeOf, test } from 'vite-plus/test'
import type { Options, WebMetadata } from 'zyzz/babel'

describe('zyzz', () => {
  test('separates web output options from native context', () => {
    const web = { target: 'web', cssOutput: 'grouped' } satisfies Options
    const native = {
      target: 'native',
      platform: 'ios',
      colorScheme: 'light',
    } satisfies Options
    expectTypeOf(web.target).toEqualTypeOf<'web'>()
    expectTypeOf(native.platform).toEqualTypeOf<'ios'>()
    expectTypeOf<Babel.BabelFileMetadata['zyzz']>().toEqualTypeOf<
      WebMetadata | undefined
    >()

    // @ts-expect-error Web compilation does not accept a native platform.
    const invalid = { target: 'web', platform: 'ios' } satisfies Options
    void invalid
    // @ts-expect-error Native compilation requires a resolved scheme.
    const unresolved = { target: 'native', platform: 'ios' } satisfies Options
    void unresolved
  })
})
