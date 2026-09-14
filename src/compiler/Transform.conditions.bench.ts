/** Measures nested conditions over shared repeated, unique, and component workloads. @module */
import { bench, describe } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Corpus from '../../bench/Corpus.js'

for (const workload of Corpus.cases) {
  const source =
    'import {css} from "zyzz";' +
    Corpus.styles(workload)
      .map(
        (style, index) =>
          `export const card${index}=css(${JSON.stringify({ ...style, ':hover': style, '@media (width >= 48rem)': style })})()`,
      )
      .join('\n')

  describe(`compile / conditions / ${workload.name}`, () => {
    bench(
      'shared corpus',
      () => {
        Transform.compile({
          composition: 'independent',
          cssOutput: 'grouped',
          moduleId: 'conditions.ts',
          source,
        })
      },
      { time: 1000, warmupTime: 500 },
    )
  })
}
