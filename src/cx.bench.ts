/** Measures static composition using complete integration corpus projects. @module */
import { bench, describe } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Fixture from '../test/fixtures/composition.js'

for (const workload of Fixture.cases) {
  const options = {
    moduleId: `composition-${workload.name}.ts`,
    source: Fixture.source({
      binding: false,
      conditional: false,
      output: 'react',
      workload,
    }),
  }
  describe(`cx / static / ${workload.name} (${workload.count} styles)`, () => {
    bench(
      'compile',
      () => {
        Transform.compile(options)
      },
      { time: 250, warmupTime: 100 },
    )
  })
}
