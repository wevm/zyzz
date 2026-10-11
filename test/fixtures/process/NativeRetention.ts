/** Exercises native compiler result retention in an isolated garbage-collected process. @module */
import * as Timers from 'node:timers/promises'
import * as Graph from '../../../src/compiler/Graph.js'

function compile() {
  const moduleId = 'app.ts'
  const modules = {
    [moduleId]: `import {style} from 'zyzz';export const card=style({width:'12px'});`,
  }
  const reference = new WeakRef(modules)
  const result = Graph.compile({
    modules,
    native: { colorScheme: 'light', units: { px: 1 } },
  })

  return { reference, result }
}

const retained = compile()
for (let index = 0; index < 5; index++) {
  // WeakRef targets remain alive until the current JavaScript job ends.
  await Timers.setImmediate()
  globalThis.gc!()
}

const output = retained.result.modules['app.ts']!
console.log(
  JSON.stringify({
    released: retained.reference.deref() === undefined,
    sources: output.map.sources,
    sourcesContent: output.map.sourcesContent,
  }),
)
