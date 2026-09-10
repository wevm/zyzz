/**
 * Measures static style extraction across distinct source workload sizes.
 * @module
 */
import { bench, describe } from 'vite-plus/test'
import { Source } from 'zyzz/compiler'
import { Css } from 'zyzz/web'
import * as Templates from '../../test/fixtures/Templates.js'

describe('static template extraction', () => {
  bench(
    'extract + emit',
    () => {
      const result = Source.extract({
        moduleId: 'example/templates.ts',
        source: Templates.source,
      })
      Css.compile({ styles: result.styles })
    },
    { iterations: 3, time: 100, warmupIterations: 1, warmupTime: 50 },
  )
})

for (const count of [10, 100, 1000]) {
  const source = `import { css } from 'zyzz';\n${Array.from({ length: count }, (_, index) => `export const card${index} = css({ color: '#fff', padding: '${index}px' });`).join('\n')}`
  describe(`source extraction / ${count} styles`, () => {
    bench(
      'extract + emit',
      () => {
        const result = Source.extract({ moduleId: 'example/cards.ts', source })
        Css.compile({ styles: result.styles })
      },
      { iterations: 3, time: 100, warmupIterations: 1, warmupTime: 50 },
    )
  })
}
