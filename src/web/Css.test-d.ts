/**
 * Checks consumer inference and rejected inputs through the public Css API.
 * @module
 */
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
Css.compile({ styles: Style.define({}), themes: {} })

const independent = Css.compile({
  composition: 'independent',
  styles: Style.define({ card: { padding: 0 } }),
})
expectTypeOf<keyof typeof independent.classes>().toEqualTypeOf<'card'>()
// @ts-expect-error Compilation requires an explicit supported composition contract.
Css.compile({ composition: 'automatic', styles: Style.define({}) })
