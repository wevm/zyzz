/** Measures component-first state inference through the public integration. @module */
import { bench } from '@ark/attest'
import type * as BaseUi from '@base-ui/react/select'
import type * as Integration from 'zyzz/base-ui/react'

declare const defineConfig: typeof Integration.defineConfig
declare const Select: typeof BaseUi.Select
declare const style: typeof Integration.style
declare const Tool: ((props: { className?: string | undefined }) => null) &
  Integration.Part<{ open: boolean; status: 'running' | 'done' | 'failed' }>

/** Resolves the shared contracts before measuring authored state branches. */
export function baseline() {
  style({ color: 'red' })
  style(Select.Item, { color: 'red' })
  style(Tool, { color: 'red' })
}

bench('base ui / presence and valued states', () => {
  style(Select.Item, {
    states: {
      disabled: { opacity: 0.5 },
      highlighted: { color: 'blue' },
      selected: { fontWeight: 700 },
    },
  })
  style(Select.Popup, {
    states: { side: { bottom: { marginTop: '8px' } } },
  })
}).types([10170, 'instantiations'])

bench('base ui / configured states', () => {
  const { style } = defineConfig({
    shorthands: { px: ['paddingLeft', 'paddingRight'] },
    vars: { color: { accent: 'blue' }, spacing: { gap: '8px' } },
  })
  style(Select.Item, {
    px: 'gap',
    states: { highlighted: { color: 'accent', px: 'gap' } },
  })
}).types([20127, 'instantiations'])

bench('declared part / presence and valued states', () => {
  style(Tool, {
    states: {
      open: { opacity: 1 },
      status: { failed: { color: 'red' }, running: { color: 'blue' } },
    },
  })
}).types([8250, 'instantiations'])
