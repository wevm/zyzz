import { Style } from 'typestyle'
import { expectTypeOf } from 'vite-plus/test'
import { components } from '../fixtures/components.js'

const definition = Style.define(components)
expectTypeOf(definition.styles[0]!.name).toEqualTypeOf<
  'card' | 'label' | 'hidden'
>()
expectTypeOf(definition).toEqualTypeOf<
  Style.Definition<'card' | 'label' | 'hidden'>
>()
Style.define({
  valid: {
    padding: 0,
    margin: '-2rem',
    color: '#fff',
    lineHeight: 1.5,
    display: 'inherit',
  },
})
const typo = { card: { padding: '1rem', colour: '#fff' } } as const
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
definition.styles.push({ name: 'card', declarations: [] })
// @ts-expect-error Declaration values are readonly.
definition.styles[0]!.declarations[0]!.value = '2px'
// @ts-expect-error Percentages are not border-width values.
Style.define({ card: { borderWidth: '10%' } })
