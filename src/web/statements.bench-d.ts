/**
 * Measures type instantiations contributed by stylesheet statements and functions.
 * @module
 */
import { bench } from '@ark/attest'
import type * as Zyzz from 'zyzz'
import type * as Web from 'zyzz/web'

// Type-only imports keep the fixture free of runtime module loading; attest
// analyzes bench bodies without executing them.
declare const css: typeof Zyzz.css
declare const cssFunction: typeof Web.cssFunction
declare const customMedia: typeof Web.customMedia
declare const importCss: typeof Web.importCss
declare const namespace: typeof Web.namespace

/** Resolves the shared authoring contracts before any bench body is measured. */
export function baseline() {
  css({ [customMedia('(width < 1px)')]: { color: '#000' } })
  cssFunction({ body: { result: 1 }, parameters: [] })
}

bench('customMedia / computed query keys', () => {
  const compact = customMedia('(width < 40rem)')
  const wide = customMedia('(width >= 80rem)')

  css({ [compact]: { display: 'block' }, [wide]: { display: 'grid' } })
}).types([7230, 'instantiations'])

bench('cssFunction / typed parameters', () => {
  const mix = cssFunction({
    body: { result: 'calc(var(--amount) * 2)' },
    parameters: [
      { name: '--amount', syntax: '<number>' },
      { name: '--color', syntax: '<color>' },
      { name: '--size', syntax: '<length-percentage>' },
    ],
    returns: '<length>',
  })

  css({ width: mix(2, 'red', '50%') })
}).types([7622, 'instantiations'])

bench('importCss and namespace / statement options', () => {
  importCss({
    layer: true,
    media: 'screen',
    supports: 'display: grid',
    url: './base.css',
  })
  namespace({ prefix: 'svg', uri: 'http://www.w3.org/2000/svg' })
}).types([84, 'instantiations'])
