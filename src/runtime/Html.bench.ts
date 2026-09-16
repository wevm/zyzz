/** Measures DOM output conversion of compiled dynamic styling props. @module */
import { bench, describe } from 'vite-plus/test'
import type { style } from 'zyzz'
import { Dynamic } from 'zyzz/runtime'
import { Html as Attrs } from 'zyzz/runtime'

const card = Dynamic.create({
  className: 'z-card',
  slots: { width: { name: '--width', type: 'string' } },
}) as style.Dynamic<{ width: string }>

describe('DOM styling attributes', () => {
  bench('dynamic props', () => {
    card({ width: '25%', style: { marginTop: '12px' } })
  })
  bench('dynamic DOM attributes', () => {
    Attrs.from(card({ width: '25%', style: { marginTop: '12px' } }))
  })
  bench('dynamic HTML attributes', () => {
    Attrs.serialize(
      Attrs.from(card({ width: '25%', style: { marginTop: '12px' } })),
    )
  })
})
