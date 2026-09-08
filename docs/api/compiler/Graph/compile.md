# Graph.compile

Link named theme imports, extensions, authoring aliases, and re-exports without executing source or reading files.

```ts
import { Graph } from 'zyzz/compiler'

const output = Graph.compile({
  modules: {
    'app/theme.ts': `
      import { Theme } from 'zyzz'
      export const theme = Theme.define({ color: { brand: '#06c' } })
    `,
    'app/card.ts': `
      import { theme } from './theme.js'
      export const card = theme.css({ color: 'brand' })
    `,
  },
})
```

## Parameters

### options.modules

- Type: `Readonly<Record<string, string>>`
- Required: Yes.

Complete source graph keyed by stable package-relative module IDs. Relative source imports resolve against supplied files, including `.js` to `.ts` / `.tsx` and extensionless/index paths. Ambiguous paths fail. Type-only imports do not create runtime dependencies; bare package and asset imports remain external.

```ts
Graph.compile({ modules: { 'app/card.ts': source } })
```

## Returns

### dependencies

- Type: `Readonly<Record<string, readonly string[]>>`

Direct source dependencies for each module.

```ts
output.dependencies['app/card.ts'] // ['app/theme.ts']
```

### modules

- Type: `Readonly<Record<string, Transform.compile.ReturnType>>`

Rewritten source, CSS, and maps per module. Load the graph's stylesheets together. Each consumer emits its live token paths for all compatible scopes in the graph, so an alternative theme works even when defined in another file. Scope rules can repeat between consumer stylesheets.

```ts
output.modules['app/card.ts']?.code
output.modules['app/card.ts']?.css
```

Scope and variable identities retain the defining module/binding. CSS maps trace scope rules to their factory and declarations to the consuming style. JavaScript/JSX lowering remains the consuming build's responsibility.

## Errors

`Source.ExtractError` or `Css.CompileError`; no partial result is returned. Missing modules, ambiguous exports, namespace theme imports, dynamic source imports, and cycles are rejected. Package authoring contracts and independently compiled theme libraries remain unsupported; supply the complete source graph.
