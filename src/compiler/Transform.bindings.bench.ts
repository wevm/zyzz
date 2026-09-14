/** Measures compilation of explicit variable contracts and bound declarations. @module */
import { bench, describe } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'

const source = `import { variable, css } from 'zyzz'; const amount = variable('percentage'); export const bar = css({ width: amount })(); export const style = amount.set('50%');`
describe('explicit variable contracts', () => {
  bench(
    'compile',
    () => {
      Transform.compile({
        cssOutput: 'grouped',
        moduleId: 'variables.ts',
        source,
      })
    },
    { time: 200, warmupTime: 100 },
  )
})
