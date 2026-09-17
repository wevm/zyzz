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
      { units: { px: 1 } },
    )

    expectTypeOf(config.serializer.custom).toEqualTypeOf<true>()
    expectTypeOf(config.transformer.minifierPath).toEqualTypeOf<'/minifier'>()
    expectTypeOf(
      config.transformer.babelTransformerPath,
    ).toEqualTypeOf<string>()

    // @ts-expect-error Appearance is selected by the React provider.
    zyzz({}, { colorScheme: 'system' })
  })
})
