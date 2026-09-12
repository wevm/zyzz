/**
 * Measures type instantiations contributed by the public Vite entrypoint.
 * @module
 */
import { bench } from '@ark/attest'
import type * as Vite from 'zyzz/vite'

// Type-only imports keep the fixture free of runtime module loading; attest
// analyzes bench bodies without executing them.
declare const zyzz: typeof Vite.zyzz

/** Resolves the shared plugin contract before any bench body is measured. */
export function baseline() {
  void zyzz().name
}

bench('zyzz / plugin hooks', () => {
  const plugin = zyzz()

  void plugin.enforce
  void plugin.transform
  void plugin.configResolved
}).types([75, 'instantiations'])
