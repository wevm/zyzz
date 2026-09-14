/** Measures packed variant extraction using the independent publisher fixture. @module */
import { bench, describe } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'
import * as Library from '../test/fixtures/VariantLibrary.js'

for (const count of [10, 100]) {
  const publisher = Graph.compile({
    cssOutput: 'grouped',
    modules: Library.sources(),
  })
  const options = {
    contracts: publisher.contracts,
    imports: {
      'app.ts': { '@acme/variants': '@acme/variants/index.ts', zyzz: null },
    },
    modules: {
      'app.ts': `import {cx} from 'zyzz';import {controls} from '@acme/variants';\n${Array.from({ length: count }, (_, index) => `export function apply${index}(){return cx(controls.button({size:'lg',active:true}),controls.override())}`).join('\n')}`,
    },
  }

  describe(`variants / packed composition / ${count} applications`, () => {
    bench(
      'compile',
      () => {
        Graph.compile({ ...options, cssOutput: 'grouped' })
      },
      { time: 250, warmupTime: 100 },
    )
  })
}
