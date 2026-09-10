/** Measures compilation of live theme references in template declarations. @module */
import { bench, describe } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'

const source =
  'import { Theme, css } from "zyzz"; const theme = Theme.define({spacing:{md:"8px"}}); export const box = css({width:`calc(100% - ${theme.vars.spacing.md})`})()'
describe('theme variable templates', () => {
  bench(
    'compile',
    () => {
      Transform.compile({ moduleId: 'variables.ts', source })
    },
    { time: 200, warmupTime: 100 },
  )
})
