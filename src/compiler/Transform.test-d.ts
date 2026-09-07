import { expectTypeOf } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'

const result = Transform.compile({ moduleId: 'package/button.ts', source: '' })
expectTypeOf(result.code).toEqualTypeOf<string>()
expectTypeOf(result.css).toEqualTypeOf<string>()
expectTypeOf(result.map.version).toEqualTypeOf<3>()
expectTypeOf(result.classes).toEqualTypeOf<Readonly<Record<string, string>>>()
// @ts-expect-error Module identity is mandatory.
Transform.compile({ source: '' })
// @ts-expect-error Host filesystem options do not belong to the transform.
Transform.compile({ moduleId: 'button.ts', source: '', write: true })
