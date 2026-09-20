/** Measures compilation of live theme references in template declarations. @module */
import { bench, describe } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'

const source =
  'import {Config} from \'zyzz\';\nimport { style, Vars } from "zyzz"; const theme = Vars.define({spacing:{md:"8px"}}); const themeConfig=Config.create({vars:theme}); export const box = themeConfig.style({width:`calc(100% - ${theme.spacing.md})`})()'
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
