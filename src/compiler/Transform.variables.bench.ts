/** Measures compilation of live theme references in template declarations. @module */
import { bench, describe } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'

const source =
  'import { style, Theme } from "zyzz"; const theme = Theme.define({spacing:{md:"8px"}}); export const box = theme.style({width:`calc(100% - ${theme.vars.spacing.md})`})()'
describe('theme variable templates', () => {
  bench(
    'compile',
    () => {
      Transform.compile({
        composition: 'independent',
        cssOutput: 'grouped',
        moduleId: 'variables.ts',
        source,
      })
    },
    { time: 200, warmupTime: 100 },
  )
})
