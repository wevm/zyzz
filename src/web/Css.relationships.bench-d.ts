/**
 * Measures type instantiations contributed by marker refs and relationship keys.
 * @module
 */
import { bench } from '@ark/attest'
import type * as Zyzz from 'zyzz'
import type * as Web from 'zyzz/web'

// Type-only imports keep the fixture free of runtime module loading; attest
// analyzes bench bodies without executing them.
declare const ancestor: typeof Web.ancestor
declare const anySibling: typeof Web.anySibling
declare const css: typeof Zyzz.css
declare const descendant: typeof Web.descendant
declare const ref: typeof Web.ref
declare const siblingAfter: typeof Web.siblingAfter
declare const siblingBefore: typeof Web.siblingBefore

/** Resolves the shared authoring contracts before any bench body is measured. */
export function baseline() {
  css({ [descendant(ref())]: { color: '#000' } })
}

bench('ref / finite state schema', () => {
  const card = ref({
    selected: [true, false],
    state: ['open', 'closed'],
  })

  card({ selected: false, state: 'open' })
}).types([812, 'instantiations'])

bench('relationships / computed condition keys', () => {
  const card = ref({ selected: [true, false], state: ['open', 'closed'] })

  css({
    [ancestor(card, { has: 'a', pseudo: ':hover', state: 'open' })]: {
      color: '#222',
    },
    [anySibling(card, { selected: true })]: { opacity: 0.5 },
    [descendant(card)]: { color: '#111' },
    [siblingAfter(card, { state: 'closed' })]: { display: 'none' },
    [siblingBefore(card, ':checked')]: { color: '#333' },
  })
}).types([15441, 'instantiations'])

bench('relationships / dynamic callback keys', () => {
  const card = ref({ state: ['open', 'closed'] })

  css((values: { color: '#123' | '#456' }) => ({
    [ancestor(card, { state: 'open' })]: { color: values.color },
  }))
}).types([1539, 'instantiations'])
