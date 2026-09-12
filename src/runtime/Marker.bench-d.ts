/**
 * Measures type instantiations contributed by runtime marker bindings.
 * @module
 */
import { bench } from '@ark/attest'
import type * as Runtime from 'zyzz/runtime'

// Type-only imports keep the fixture free of runtime module loading; attest
// analyzes bench bodies without executing them.
declare const Marker: typeof Runtime.Marker

/** Resolves the shared marker contract before any bench body is measured. */
export function baseline() {
  Marker.create({ id: 'data-z-base', schema: Marker.schema({ on: [true] }) })
}

bench('create / finite state attributes', () => {
  const card = Marker.create({
    id: 'data-z-card',
    schema: Marker.schema({
      selected: [true, false],
      size: ['sm', 'md', 'lg'],
      state: ['open', 'closed'],
    }),
  })

  card({ selected: false, size: 'md', state: 'open' })
}).types([183, 'instantiations'])
