/**
 * Checks the public source-graph compiler contract.
 * @module
 */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'
import type { Transform } from 'zyzz/compiler'

describe('compile', () => {
  test('preserves graph outputs and validates inputs and contracts', () => {
    const result = Graph.compile({ modules: { 'pkg/theme.ts': '' } })
    expectTypeOf(result.modules).toEqualTypeOf<
      Readonly<Record<string, Transform.compile.ReturnType>>
    >()
    expectTypeOf(result.dependencies).toEqualTypeOf<
      Readonly<Record<string, readonly string[]>>
    >()
    // @ts-expect-error Module source must be text.
    Graph.compile({ modules: { 'pkg/theme.ts': 1 } })
    // @ts-expect-error A complete source graph is required.
    Graph.compile({})
    // @ts-expect-error Graph outputs are readonly.
    result.modules.extra = result.modules['pkg/theme.ts']!
    // @ts-expect-error Dependencies cannot be mutated.
    result.dependencies['pkg/theme.ts']!.push('pkg/other.ts')

    Graph.compile({
      imports: { 'pkg/a.ts': { '@theme': 'pkg/theme.ts', react: null } },
      modules: {},
    })
    // @ts-expect-error Host edges must be module IDs or explicit externals.
    Graph.compile({ imports: { 'pkg/a.ts': { '@theme': false } }, modules: {} })

    expectTypeOf(result.contracts).toEqualTypeOf<
      Readonly<Record<string, string>>
    >()
    Graph.compile({ contracts: result.contracts, imports: {}, modules: {} })
    // @ts-expect-error Library contracts must be serialized JSON text.
    Graph.compile({ contracts: { 'library/index.js': {} }, modules: {} })
  })
})

describe('create', () => {
  test('retains the compile contract', () => {
    const compiler = Graph.create()
    expectTypeOf(compiler.compile).toEqualTypeOf<typeof Graph.compile>()
    expectTypeOf(
      compiler.compile({ modules: {} }),
    ).toEqualTypeOf<Graph.compile.ReturnType>()
    // @ts-expect-error Incremental source values must be text.
    compiler.compile({ modules: { 'pkg/theme.ts': 1 } })
    // @ts-expect-error The complete source graph remains required.
    compiler.compile({})
  })
})
