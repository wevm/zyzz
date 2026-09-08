import { expectTypeOf } from 'vite-plus/test'
import { Host } from 'zyzz/node'

const host = await Host.create({
  outDir: 'dist',
  packageId: 'example',
  root: 'src',
})
expectTypeOf(host.build()).toEqualTypeOf<Promise<Host.Build>>()
expectTypeOf(host.close()).toEqualTypeOf<Promise<void>>()
// @ts-expect-error Package identity must be explicit.
void Host.create({ outDir: 'dist', root: 'src' })
