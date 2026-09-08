# Graph.create

Create an isolated compiler that reuses work across complete source snapshots.

```ts
import { Graph } from 'zyzz/compiler'

const compiler = Graph.create()
const first = compiler.compile({ modules })
const next = compiler.compile({
  modules: { ...modules, 'app/card.ts': updatedSource },
})
```

## Returns

### compile

- Type: `(options: Graph.compile.Options) => Graph.compile.ReturnType`

Accepts the same inputs and returns the same code, CSS, dependencies, and maps as [Graph.compile](compile.md). Unchanged snapshots reuse the previous result. Source or resolved-import changes re-extract the changed modules and their transitive importers; unaffected transforms are reused when the theme contracts are unchanged.

```ts
const output = compiler.compile({ modules })
output.modules['app/card.ts']?.css
```

Theme contract changes re-emit all modules because compatible scopes can affect consumers without a direct import. File additions and removals trigger a full rebuild to recheck source resolution. Failed compilation retains the last successful snapshot.

Each compiler owns one snapshot; no cache is shared between instances or persisted to disk. Drop the compiler to release its cache. The file host uses this lifecycle automatically.
