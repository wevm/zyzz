/** Measures compilation of explicit variable contracts and bound declarations. @module */
import { bench, describe } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'

const source = `import { style, variable } from 'zyzz'; const amount = variable('percentage'); export const bar = style({ width: amount })(); export const style = amount.set('50%');`
describe('explicit variable contracts', () => {
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
