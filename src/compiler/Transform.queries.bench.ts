/** Measures compilation of scalar typography with independent query metadata. @module */
import { bench, describe } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
const source =
  'import {Theme} from "zyzz"; const theme=Theme.define({breakpoints:{tablet:"48rem"},fontSize:{body:"1rem"},fontWeight:{medium:500}}); export const body=theme.css({fontSize:"body",fontWeight:"medium"})()'
describe('typography and query metadata', () => {
  bench(
    'compile',
    () => {
      Transform.compile({ moduleId: 'theme.ts', source })
    },
    { time: 200, warmupTime: 100 },
  )
})
