/** Checks target-specific Babel options and typed stylesheet metadata. @module */
import type * as Babel from '@babel/core'
import { describe, expectTypeOf, test } from 'vite-plus/test'
import type { Options, WebMetadata } from 'zyzz/babel'
import { Native, NativeContext } from 'zyzz/runtime'

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
    const unresolved = { target: 'native', platform: 'ios' } satisfies Options
    void unresolved
    const prepared = Native.create({
      axes: { size: ['large'] },
      defaults: {},
      styles: { '0': { opacity: 1 }, '1': {} },
    })
    const contextual = NativeContext.create(
      { base: { light: prepared, dark: prepared } },
      'base',
    )
    contextual({ size: 'large' })
    // @ts-expect-error Context selection retains the compiled recipe inputs.
    contextual({ size: 'missing' })
  })
})
