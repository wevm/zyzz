/** Measures type instantiations for selector templates and nested declarations. @module */
/* oxlint-disable typescript/restrict-template-expressions -- Selector references are resolved at compile time. */
import { bench } from '@ark/attest'
import type * as Zyzz from 'zyzz'

declare const css: typeof Zyzz.css

/** Warms shared authoring contracts before measuring selectors. */
export function baseline() {
  css({ selectors: { [`&:hover`]: { color: 'black' } } })
}

bench('selectors / style references', () => {
  const card = css({})
  css({
    selectors: {
      [`${card}:hover &`]: { color: 'blue' },
      [`${card} > &:nth-child(even)`]: { opacity: 0.5 },
    },
  })
}).types([5985, 'instantiations'])
