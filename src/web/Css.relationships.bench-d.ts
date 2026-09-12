/**
 * Measures type instantiations contributed by where relationship keys.
 * @module
 */
import { bench } from '@ark/attest'
import type * as Zyzz from 'zyzz'
import type * as Web from 'zyzz/web'

// Type-only imports keep the fixture free of runtime module loading; attest
// analyzes bench bodies without executing them.
declare const css: typeof Zyzz.css
declare const where: typeof Web.where

/** Resolves the shared authoring contracts before any bench body is measured. */
export function baseline() {
  const base = css({ color: '#000' })
  css({ [where`${base} &`]: { color: '#000' } })
}

bench('where / computed condition keys', () => {
  const card = css({ display: 'grid' })
  const trigger = css({ color: '#123' })

  css({
    [where`${card}[aria-expanded="true"] &`]: { color: '#222' },
    [where`${card}:has(${trigger}:hover) &`]: { opacity: 0.5 },
    [where`${card} ~ &`]: { display: 'none' },
    [where`${trigger}:hover + &`]: { color: '#333' },
  })
}).types([14599, 'instantiations'])

bench('where / dynamic callback keys', () => {
  const card = css({ display: 'grid' })

  css((values: { color: '#123' | '#456' }) => ({
    [where`${card}[data-state="open"] &`]: { color: values.color },
  }))
}).types([7707, 'instantiations'])
