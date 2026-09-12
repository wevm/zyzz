/** Measures type instantiations for selector templates and nested declarations. @module */
import { bench } from '@ark/attest'
import type * as Zyzz from 'zyzz'

declare const css: typeof Zyzz.css
declare const where: typeof Zyzz.where

/** Warms shared authoring contracts before measuring selectors. */
export function baseline() {
  css({ [where`&:hover`]: { color: 'black' } })
}

bench('where / style references', () => {
  const card = css({})
  css({
    [where`${card}:hover &`]: { color: 'blue' },
    [where`${card} > &:nth-child(even)`]: { opacity: 0.5 },
  })
}).types([6010, 'instantiations'])
