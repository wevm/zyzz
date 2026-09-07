import { expectTypeOf } from 'vite-plus/test'
import { Style } from 'zyzz'
import { Css } from 'zyzz/web'

const result = Css.compile({ styles: Style.define({ card: { padding: 0 } }) })
expectTypeOf(result.classes.card).toEqualTypeOf<string>()
expectTypeOf<keyof typeof result.classes>().toEqualTypeOf<'card'>()
expectTypeOf(result.css).toEqualTypeOf<string>()
// @ts-expect-error Unknown style names remain rejected.
expectTypeOf(result.classes.missing)
// @ts-expect-error Results are readonly.
result.classes.card = 'changed'
// @ts-expect-error Theme compilation is not supported at the literal boundary.
Css.compile({ styles: Style.define({}), themes: {} })
