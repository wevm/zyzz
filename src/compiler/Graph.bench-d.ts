/**
 * Measures type instantiations contributed by public source-graph compilation.
 * @module
 */
import { bench } from '@ark/attest'
import type * as Compiler from 'zyzz/compiler'

// Type-only imports keep the fixture free of runtime module loading; attest
// analyzes bench bodies without executing them.
declare const Graph: typeof Compiler.Graph

/** Resolves the shared graph contract before any bench body is measured. */
export function baseline() {
  Graph.compile({ modules: {} })
}

bench('compile / linked modules and contracts', () => {
  const result = Graph.compile({
    contracts: { 'library/index.js': '{}' },
    imports: { 'pkg/card.ts': { '@theme': 'pkg/theme.ts', react: null } },
    modules: { 'pkg/card.ts': '', 'pkg/theme.ts': '' },
  })

  void result.contracts['pkg/theme.ts']
  void result.dependencies['pkg/card.ts']?.length
  void result.modules['pkg/card.ts']?.css
}).types([69, 'instantiations'])

bench('create / incremental compiler', () => {
  const compiler = Graph.create()

  void compiler.compile({ modules: { 'pkg/theme.ts': '' } }).modules
}).types([8, 'instantiations'])
