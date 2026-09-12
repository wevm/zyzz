/** Checks marker state inference and relationship-key authoring without broad state domains. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { css, Style } from 'zyzz'
import { Marker } from 'zyzz/runtime'
import {
  ancestor,
  anySibling,
  descendant,
  global,
  ref,
  siblingAfter,
  siblingBefore,
} from 'zyzz/web'

describe('ref', () => {
  test('retains finite states and typed relationships', () => {
    const card = ref({
      state: ['open', 'closed'],
      selected: [true, false],
    })

    expectTypeOf(card({ selected: false })).toMatchTypeOf<
      Readonly<Record<`data-${string}`, string>>
    >()

    css({
      [ancestor(card, {
        state: 'open',
        pseudo: ':hover',
        has: 'a',
      })]: { color: 'red' },
    })
    css({
      [descendant(card)]: { color: 'red' },
      [siblingBefore(card, ':checked')]: { color: 'blue' },
    })

    const arbitrary = Symbol()

    // @ts-expect-error arbitrary symbols are not relationship keys
    css({ [arbitrary]: { color: 'red' } })
    // @ts-expect-error descendant has would require forbidden nested :has
    descendant(card, { has: 'a' })
    // @ts-expect-error following-sibling has would require forbidden nested :has
    siblingAfter(card, { has: 'a' })
    // @ts-expect-error invalid state-name characters
    ref({ 'not ok': ['open'] })
    // @ts-expect-error case-folded duplicate names
    ref({ State: ['open'], state: ['closed'] })

    // @ts-expect-error Relationship predicates reserve their option names.
    ref({ pseudo: ['open'] })
    // @ts-expect-error Relationship predicates reserve their option names case-insensitively.
    ref({ Has: ['open'] })
    // @ts-expect-error State selection is flat, without a data wrapper.
    ancestor(card, { data: { state: 'open' } })
    // @ts-expect-error Descendant selections retain finite state values.
    descendant(card, { state: 'other' })
    // @ts-expect-error Sibling selections retain finite state values.
    siblingBefore(card, { state: 'other' })
    // @ts-expect-error Sibling selections retain finite state values.
    siblingAfter(card, { state: 'other' })
    // @ts-expect-error Sibling selections retain finite state values.
    anySibling(card, { state: 'other' })

    const presence = ref(undefined)

    // @ts-expect-error explicit undefined is presence-only
    presence({ unknown: 'open' })
    ancestor(card, { state: undefined })
    css((values: { color: '#123' | '#456' }) => ({
      [ancestor(card)]: { color: values.color },
    }))

    const extra = { state: 'open' as const, unknown: 'value' }

    // @ts-expect-error state keys stay exact through variables
    ancestor(card, extra)
    // @ts-expect-error unknown states do not widen schema
    card({ status: 'open' })
    // @ts-expect-error invalid values remain errors
    ancestor(card, { state: 'other' })
    // @ts-expect-error unknown conditions remain errors
    ancestor(card, ':hovr')
    // @ts-expect-error unbounded domains
    ref({ state: [] as string[] })
    // @ts-expect-error widened scalar domain
    ref({ state: ['open' as string] })
    // @ts-expect-error union element does not describe the concrete extracted domain
    ref({ state: ['open' as 'open' | 'closed'] })
    // @ts-expect-error widened boolean element
    ref({ selected: [true as boolean] })
    // @ts-expect-error empty domains
    ref({ state: [] })
    // @ts-expect-error serialization ambiguity
    ref({ state: [false, 'false'] })
  })
})

describe('global', () => {
  test('excludes marker relationships from global declarations', () => {
    const card = ref()

    // @ts-expect-error ordinary nested conditions cannot hide relationships
    global({ body: { ':hover': { [ancestor(card)]: { color: 'red' } } } })
    // @ts-expect-error runtime identities must remain private data attributes
    Marker.create({ id: 'className', schema: Marker.schema({}) })
    // @ts-expect-error global rules cannot contain marker relationship keys
    global({ body: { [ancestor(card)]: { color: 'red' } } })
  })
})

describe('relationships', () => {
  test('requires compiler marker provenance', () => {
    // @ts-expect-error arbitrary callables do not carry marker provenance
    ancestor(() => ({}))
  })
})

describe('define', () => {
  test('excludes source-only relationships from core definitions', () => {
    const card = ref()

    // @ts-expect-error core definitions do not compile marker helpers
    Style.define({ target: { [ancestor(card)]: { color: 'red' } } })
    // @ts-expect-error visited cannot be observed through has
    descendant(card, ':visited')
    // @ts-expect-error visited cannot be observed through has
    siblingAfter(card, { pseudo: ':visited' })
  })
})

describe('create', () => {
  test('retains runtime marker state domains', () => {
    const mutable = { state: ['open'] }
    const frozen = Marker.schema(mutable)

    // @ts-expect-error copied domains are readonly
    frozen.state.push('closed')
    // @ts-expect-error copied schema fields are readonly
    frozen.state = ['closed']

    const card = Marker.create({
      id: 'data-z-card',
      schema: Marker.schema({ state: ['open'], selected: [true, false] }),
    })

    card({ state: 'open', selected: false })
    // @ts-expect-error invalid state value
    card({ state: 'closed' })
    // @ts-expect-error unknown state key
    card({ unknown: true })

    const extra = { state: 'open' as const, unknown: true }

    // @ts-expect-error unknown state keys remain invalid through bindings
    card(extra)
  })
})
