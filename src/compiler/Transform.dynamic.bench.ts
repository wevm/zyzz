/** Measures compilation of dynamic callbacks with static declarations. @module */
import { bench, describe } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'

const source =
  'import { css } from "zyzz"; export const bar = css((values:{amount:string;alpha:number})=>({display:"block",width:values.amount,opacity:values.alpha}));'
describe('dynamic callbacks', () => {
  bench(
    'compile',
    () => {
      Transform.compile({ moduleId: 'variables.ts', source })
    },
    { time: 200, warmupTime: 100 },
  )
})
