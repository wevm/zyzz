/** Measures compilation of explicit variable contracts and bound declarations. @module */
import { bench, describe } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'

const source =
  'import { Vars, css } from "zyzz"; const progress = Vars.define({ amount: "percentage" }); export const bar = css({width:progress.amount})(); export const style = progress.set({amount:"50%"});'
describe('explicit variable contracts', () => {
  bench(
    'compile',
    () => {
      Transform.compile({ moduleId: 'variables.ts', source })
    },
    { time: 200, warmupTime: 100 },
  )
})
