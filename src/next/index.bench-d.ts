/** Measures type instantiations for Next.js configuration composition. @module */
import { bench } from '@ark/attest'
import type * as Next from 'zyzz/next'

declare const zyzz: typeof Next.zyzz

/** Warms the shared Next.js configuration contract. */
export function baseline() {
  void zyzz({}).turbopack
}

bench('zyzz / next configuration', () => {
  const config = zyzz({ reactStrictMode: true, distDir: 'build' })

  void config.webpack
  void config.turbopack
}).types([0, 'instantiations'])

bench('zyzz / async next configuration', () => {
  const config = zyzz(async (phase, { defaultConfig }) => ({
    ...defaultConfig,
    env: { phase },
  }))

  void config('phase-production-build', { defaultConfig: {} })
}).types([142, 'instantiations'])
