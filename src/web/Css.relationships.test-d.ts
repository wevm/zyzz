/** Checks marker state inference and where relationship authoring without broad state domains. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { css, Style } from 'zyzz'
import { Marker } from 'zyzz/runtime'
import { global, ref, where } from 'zyzz/web'

describe('ref', () => {
  test('retains finite states and typed where interpolations', () => {
    const card = ref({
      state: ['open', 'closed'],
      selected: [true, false],
    })

    expectTypeOf(card({ selected: false })).toMatchTypeOf<
      Readonly<Record<`data-${string}`, string>>
    >()

    css({
      [where`${card({ state: 'open' })}:hover &`]: { color: 'red' },
    })
    css({
      [where`&:has(${card})`]: { color: 'red' },
      [where`${card}:checked ~ &`]: { color: 'blue' },
      [where`${card}:has(${card({ selected: true })}) &`]: { color: 'green' },
    })

    const arbitrary = Symbol()

    // @ts-expect-error arbitrary symbols are not relationship keys
    css({ [arbitrary]: { color: 'red' } })
    // @ts-expect-error invalid state-name characters
    ref({ 'not ok': ['open'] })
    // @ts-expect-error case-folded duplicate names
    ref({ State: ['open'], state: ['closed'] })
    // @ts-expect-error application keys stay reserved case-insensitively
    ref({ ClassName: ['open'] })

    ref({ pseudo: ['open'], has: ['a'] })

    // @ts-expect-error State selection is flat, without a data wrapper.
    void where`${card({ data: { state: 'open' } })} &`
    // @ts-expect-error Selections retain finite state values.
    void where`${card({ state: 'other' })} &`
    // @ts-expect-error Interpolations require refs.
    void where`${'[data-open]'} &`
    // @ts-expect-error Hand-written attributes are not ref applications.
    void where`${{ 'data-z-card': '' }} &`

    const presence = ref(undefined)

    // @ts-expect-error explicit undefined is presence-only
    presence({ unknown: 'open' })
    void where`${card({ state: undefined })} &`
    css((values: { color: '#123' | '#456' }) => ({
      [where`${card} &`]: { color: values.color },
    }))

    const extra = { state: 'open' as const, unknown: 'value' }

    // @ts-expect-error state keys stay exact through variables
    card(extra)
    // @ts-expect-error unknown states do not widen schema
    card({ status: 'open' })
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
    global({ body: { ':hover': { [where`${card} &`]: { color: 'red' } } } })
    // @ts-expect-error runtime identities must remain private data attributes
    Marker.create({ id: 'className', schema: Marker.schema({}) })
    // @ts-expect-error global rules cannot contain marker relationship keys
    global({ body: { [where`${card} &`]: { color: 'red' } } })
  })
})

describe('where', () => {
  test('requires compiler marker provenance', () => {
    // @ts-expect-error arbitrary callables do not carry marker provenance
    void where`${() => ({})} &`
  })
})

describe('define', () => {
  test('excludes source-only relationships from core definitions', () => {
    const card = ref()

    // @ts-expect-error core definitions do not compile marker relationships
    Style.define({ target: { [where`${card} &`]: { color: 'red' } } })
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
