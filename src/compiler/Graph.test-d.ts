/** Checks the public source-graph compiler contract. */
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
