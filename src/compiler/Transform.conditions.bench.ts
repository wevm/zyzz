/** Measures ordered nested selector and query compilation through the public transform. @module */
import { bench, describe } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
const source =
  'import {Theme} from "zyzz"; const theme=Theme.define({breakpoints:{tablet:"48rem"}}); export const box=theme.css({width:"40px",":hover":{opacity:0.5},"@media tablet":{width:"80px"}})()'
describe('nested conditions', () => {
  bench(
    'compile',
    () => {
      Transform.compile({ moduleId: 'conditions.ts', source })
    },
    { time: 200, warmupTime: 100 },
  )
})
