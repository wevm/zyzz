/** Measures the public shared stylesheet graph workflow. @module */
import { bench, describe } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'
const modules = {
  'app.ts': 'import {css} from "zyzz"; export const box=css({color:"red"})()',
  'global.ts':
    'import {global,keyframes,Css} from "zyzz/web"; Css.layers(["reset","base"]); global({body:{margin:0}}); export const fade=keyframes({from:{opacity:0},to:{opacity:1}})',
}
describe('stylesheet contributions', () => {
  bench(
    'compile shared graph',
    () => {
      Graph.compile({ modules })
    },
    { time: 200, warmupTime: 100 },
  )
})
