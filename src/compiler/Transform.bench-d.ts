/**
 * Measures type instantiations contributed by the public module transform.
 * @module
 */
import { bench } from '@ark/attest'
import type * as Compiler from 'zyzz/compiler'

// Type-only imports keep the fixture free of runtime module loading; attest
// analyzes bench bodies without executing them.
declare const Transform: typeof Compiler.Transform

/** Resolves the shared compiler contract before any bench body is measured. */
export function baseline() {
  Transform.compile({ moduleId: 'base.ts', source: '' })
}

bench('compile / rewritten module outputs', () => {
  const result = Transform.compile({
    moduleId: 'package/button.ts',
    source: "import { css } from 'zyzz'",
  })

  void result.classes.button
  void result.code.length
  void result.css.length
  void result.cssMap.version
  void result.map.sources
}).types([17, 'instantiations'])
