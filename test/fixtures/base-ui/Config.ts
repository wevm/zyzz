/** Supplies the variable contract used by the Base UI browser fixture. @module */
import { defineConfig } from 'zyzz/base-ui/react'

/** Shared authoring and references for both compiler modes. */
export const { style, vars } = defineConfig({
  id: 'base-ui-example',
  shorthands: { px: ['paddingLeft', 'paddingRight'] },
  vars: {
    color: {
      highlight: '#dbeafe',
      ink: '#172554',
      selected: '#1d4ed8',
      surface: '#ffffff',
    },
    spacing: { control: '10px', gap: '8px' },
  },
})
