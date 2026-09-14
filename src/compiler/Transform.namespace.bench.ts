/** Measures module-owned namespace rewriting and packed selector publication. @module */
import { bench, describe } from 'vite-plus/test'
import { Graph, Transform } from 'zyzz/compiler'

for (const count of [10, 100]) {
  const rules = Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `s|item${index}`,
      { color: 'red' },
    ]),
  )
  const source = `import {namespace,global} from 'zyzz/web';namespace({prefix:'s',uri:'urn:shapes'});global(${JSON.stringify(rules)});`
  const library = Graph.compile({
    cssOutput: 'grouped',
    modules: { 'shapes.ts': source },
  })
  describe(`namespace publication / ${count} selectors`, () => {
    bench(
      'source transform with maps',
      () => {
        Transform.compile({
          cssOutput: 'grouped',
          moduleId: 'shapes.ts',
          source,
        })
      },
      { iterations: 20, time: 1000 },
    )
    bench(
      'packed stylesheet consumption',
      () => {
        Graph.compile({
          cssOutput: 'grouped',
          contracts: { 'lib.js': library.contracts['shapes.ts']! },
          imports: { 'app.ts': { lib: 'lib.js' } },
          modules: { 'app.ts': `import 'lib';` },
        })
      },
      { iterations: 20, time: 1000 },
    )
  })
}
