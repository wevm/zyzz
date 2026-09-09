/**
 * Checks consumer inference and rejected inputs through the public Host API.
 * @module
 */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Host } from 'zyzz/node'

describe('create', () => {
  test('types host lifecycle and CSS processing options', async () => {
    await using host = await Host.create({
      css: { minify: true, targets: { safari: 12 << 16 } },
      outDir: 'dist',
      packageId: 'example',
      root: 'src',
    })
    expectTypeOf(host.build()).toEqualTypeOf<Promise<Host.Build>>()
    expectTypeOf(host[Symbol.asyncDispose]()).toEqualTypeOf<Promise<void>>()
    expectTypeOf(host.close()).toEqualTypeOf<Promise<void>>()
    // @ts-expect-error Package identity must be explicit.
    void Host.create({ outDir: 'dist', root: 'src' })

    void Host.create({
      css: false,
      outDir: 'dist',
      packageId: 'example',
      root: 'src',
    })
    void Host.create({
      // @ts-expect-error Browser targets use numeric encoded versions.
      css: { targets: { safari: '12' } },
      outDir: 'dist',
      packageId: 'example',
      root: 'src',
    })
    void Host.create({
      // @ts-expect-error CSS processing exposes a narrow contract.
      css: { cssModules: true },
      outDir: 'dist',
      packageId: 'example',
      root: 'src',
    })
  })
})
