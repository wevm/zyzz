/** Exercises native compiler result retention in an isolated garbage-collected process. @module */
import * as Timers from 'node:timers/promises'
import * as Graph from '../../../src/compiler/Graph.js'
import * as Syntax from '../../../src/compiler/internal/Syntax.js'

function compile() {
  const moduleId = 'app.ts'
  const source = `import {style} from 'zyzz';export const card=style({width:'12px'});`
  const parsed = Syntax.parse({ moduleId, source })
  const reference = new WeakRef(parsed.program)
  const result = Graph.compile({
    [Syntax.cache]: new Map([[moduleId, parsed]]),
    modules: { [moduleId]: source },
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
