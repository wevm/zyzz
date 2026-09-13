/** Measures public composition inference for applied static styles. @module */
import { bench } from '@ark/attest'
import type * as Zyzz from 'zyzz'

declare const css: typeof Zyzz.css
declare const cx: typeof Zyzz.cx

/** Warms static style inference outside the measured composition. */
export function baseline() {
  css({ display: 'block' })
}

bench('cx / ordered static props', () => {
  const a = css({ padding: '8px', color: 'red' })
  const b = css({ paddingLeft: '12px', color: 'blue' })
  cx(a(), false, null, undefined, b(), a())
}).types([30422, 'instantiations'])
