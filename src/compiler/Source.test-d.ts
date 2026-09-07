import { expectTypeOf } from 'vite-plus/test'
import type { Style } from 'zyzz'
import { Source } from 'zyzz/compiler'

const result = Source.extract({ moduleId: 'example/card.ts', source: '' })
expectTypeOf(result.styles).toEqualTypeOf<Style.Definition>()
expectTypeOf(result.calls).toEqualTypeOf<readonly Source.Call[]>()
// @ts-expect-error A portable host module ID is required.
Source.extract({ source: '' })
// @ts-expect-error Call-site metadata is immutable.
result.calls.push({ end: 1, name: 'card', start: 0 })
