/** Checks preservation of caller-owned Metro settings through the adapter. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { zyzz } from 'zyzz/metro'

describe('zyzz', () => {
  test('preserves custom transformer and serializer configuration', () => {
    const config = zyzz(
      {
        projectRoot: '/application',
        resolver: { nodeModulesPaths: ['/packages'], custom: true },
        serializer: { custom: true },
        transformer: {
          babelTransformerPath: '/transformer',
          minifierPath: '/minifier',
        },
      },
      { fonts: { 'Pilat, sans-serif': 'Pilat' }, units: { px: 1, rem: 16 } },
    )

    expectTypeOf(config.resolver.resolveRequest).toBeFunction()
    expectTypeOf(zyzz({}).resolver.resolveRequest).toBeFunction()

    expectTypeOf(config.serializer.custom).toEqualTypeOf<true>()
    expectTypeOf(config.resolver.custom).toEqualTypeOf<true>()
    expectTypeOf(config.resolver.nodeModulesPaths).toEqualTypeOf<
      readonly ['/packages']
    >()
    expectTypeOf(config.transformer.minifierPath).toEqualTypeOf<'/minifier'>()
    expectTypeOf(
      config.transformer.babelTransformerPath,
    ).toEqualTypeOf<string>()

    // @ts-expect-error Appearance is selected by the React provider.
    zyzz({}, { colorScheme: 'system' })
    // @ts-expect-error Font mappings require native family names.
    zyzz({}, { fonts: { Pilat: 1 } })
    // @ts-expect-error Packed contracts are supplied by Metro resolution.
    zyzz({}, { contracts: {} })
  })
})
