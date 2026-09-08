/**
 * Checks the public source-graph compiler contract.
 * @module
 */
import { expectTypeOf } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'
import type { Transform } from 'zyzz/compiler'

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

const compiler = Graph.create()
expectTypeOf(compiler.compile).toEqualTypeOf<typeof Graph.compile>()
expectTypeOf(
  compiler.compile({ modules: {} }),
).toEqualTypeOf<Graph.compile.ReturnType>()
// @ts-expect-error Incremental source values must be text.
compiler.compile({ modules: { 'pkg/theme.ts': 1 } })
// @ts-expect-error The complete source graph remains required.
compiler.compile({})
