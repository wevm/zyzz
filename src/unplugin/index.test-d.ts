/** Checks the public bundler factories and their separate Vite options. @module */
import type { Plugin as EsbuildPlugin } from 'esbuild'
import type { Plugin as RollupPlugin } from 'rollup'
import type { Plugin as VitePlugin } from 'vite'
import { describe, expectTypeOf, test } from 'vite-plus/test'
import type { WebpackPluginInstance } from 'webpack'
import { zyzz } from 'zyzz/unplugin'

describe('zyzz', () => {
  test('returns native bundler plugins', () => {
    expectTypeOf(
      zyzz.esbuild({ root: 'src', reset: true }),
    ).toEqualTypeOf<EsbuildPlugin>()
    expectTypeOf(zyzz.rollup({ reset: true })).toEqualTypeOf<RollupPlugin>()
    expectTypeOf(zyzz.vite({ reset: true })).toEqualTypeOf<VitePlugin>()
    expectTypeOf(
      zyzz.webpack({ reset: true }),
    ).toEqualTypeOf<WebpackPluginInstance>()

    // @ts-expect-error Vite supplies its own project root.
    zyzz.vite({ root: 'src' })
    // @ts-expect-error Portable adapters compile web output.
    zyzz.esbuild({ native: { platform: 'ios', colorScheme: 'dark' } })
  })
})
