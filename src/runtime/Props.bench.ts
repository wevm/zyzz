import { bench, describe } from 'vite-plus/test'
import { Props } from 'zyzz/runtime'

const button = Props.create({ className: 'z-button' })
const overrides = {
  className: 'external',
  style: { paddingLeft: '2px' },
} as const

describe('static props binding', () => {
  bench('no overrides', () => {
    button()
  })
  bench('styling overrides', () => {
    button(overrides)
  })
})
