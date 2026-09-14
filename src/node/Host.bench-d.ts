/**
 * Measures type instantiations contributed by the public file host contract.
 * @module
 */
import { bench } from '@ark/attest'
import type * as Node from 'zyzz/node'

// Type-only imports keep the fixture free of runtime module loading. Attest
// analyzes bench bodies without executing them.
declare const Host: typeof Node.Host

/** Resolves the shared host contract before any bench body is measured. */
export function baseline() {
  void Host.create({ outDir: 'out', packageId: 'base', root: 'base' })
}

bench('create / lifecycle and CSS processing options', () => {
  void Host.create({
    css: { minify: true, targets: { safari: 12 << 16 } },
    outDir: 'dist',
    packageId: 'example',
    root: 'src',
  }).then(async (host) => {
    const build = await host.build()

    void build.changed.length
    void build.files.length
    await host.close()
  })
}).types([406, 'instantiations'])
