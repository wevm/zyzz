import { Style } from 'zyzz'
import { expectTypeOf } from 'vite-plus/test'
import { components } from '../test/fixtures/components.js'

const definition = Style.define(components)
expectTypeOf(definition.styles[0]!.name).toEqualTypeOf<
  'card' | 'hidden' | 'label'
>()
expectTypeOf(definition).toEqualTypeOf<
  Style.Definition<'card' | 'hidden' | 'label'>
>()
Style.define({
  valid: {
    color: '#fff',
    display: 'inherit',
    lineHeight: 1.5,
    margin: '-2rem',
    padding: 0,
  },
})
const typo = { card: { colour: '#fff', padding: '1rem' } } as const
// @ts-expect-error Excess properties must also fail through aliased input.
Style.define(typo)
// @ts-expect-error Unknown CSS properties are rejected.
Style.define({ card: { colour: '#fff' } })
// @ts-expect-error Core has no numeric spacing tokens.
Style.define({ card: { padding: 4 } })
// @ts-expect-error Core has no named tokens.
Style.define({ card: { color: 'blue.700' } })
// @ts-expect-error Invalid enum values cannot widen the contract.
Style.define({ card: { display: 'banana' } })
// @ts-expect-error Selectors are outside the literal subset.
Style.define({ card: { ':hover': { color: '#fff' } } })
// @ts-expect-error Callbacks are outside the literal subset.
Style.define({ card: () => ({ color: '#fff' }) })
// @ts-expect-error Undefined is not an authored CSS value.
Style.define({ card: { padding: undefined } })
// @ts-expect-error Data cannot be mutated after validation.
definition.styles.push({ declarations: [], name: 'card' })
// @ts-expect-error Declaration values are readonly.
definition.styles[0]!.declarations[0]!.value = '2px'
// @ts-expect-error Percentages are not border-width values.
Style.define({ card: { borderWidth: '10%' } })

const numeric = Style.define({ 0: { color: '#fff' }, 1.5: { padding: 0 } })
expectTypeOf(numeric).toEqualTypeOf<Style.Definition<'0' | '1.5'>>()

declare const invalidUnion: { color: '#fff' } | { colour: '#fff' }
// @ts-expect-error Every possible union branch must have supported keys.
Style.define({ card: invalidUnion })
declare const overlappingUnion: { padding: 0 } | { colour: '#fff'; padding: 0 }
// @ts-expect-error Shared valid properties must not hide a branch's typo.
Style.define({ card: overlappingUnion })
declare const callbackUnion: (() => { color: '#fff' }) | { color: '#fff' }
// @ts-expect-error A union with an executable branch is not literal data.
Style.define({ card: callbackUnion })
declare const validUnion: { color: '#fff' } | { padding: 0 }
expectTypeOf(Style.define({ card: validUnion })).toEqualTypeOf<
  Style.Definition<'card'>
>()
