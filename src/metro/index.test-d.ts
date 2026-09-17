/** Checks preservation of caller-owned Metro settings through the adapter. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { zyzz } from 'zyzz/metro'

describe('zyzz', () => {
  test('preserves custom transformer and serializer configuration', () => {
    const config = zyzz(
      {
        projectRoot: '/application',
        serializer: { custom: true },
        transformer: {
          babelTransformerPath: '/transformer',
          minifierPath: '/minifier',
        },
      },
      { colorScheme: 'light', units: { px: 1 } },
    )

    expectTypeOf(config.serializer.custom).toEqualTypeOf<true>()
    expectTypeOf(config.transformer.minifierPath).toEqualTypeOf<'/minifier'>()
    expectTypeOf(
      config.transformer.babelTransformerPath,
    ).toEqualTypeOf<string>()

    // @ts-expect-error Native compilation requires a resolved scheme.
    zyzz({}, { colorScheme: 'system' })
  })
})
