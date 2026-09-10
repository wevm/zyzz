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
      export const styles = { card: theme.css({ color: 'brand' }) }
    `,
  },
})
```

For repeated edits, [Graph.create](create.md) retains an isolated incremental cache. `Graph.compile` always starts fresh.

## Parameters

### options.contracts

- Type: `Readonly<Record<string, string>>`
- Default: No libraries.

Versioned JSON from a separately compiled graph, keyed by the host-resolved import identity. Supply an `imports` edge to that identity. Contract changes invalidate the incremental cache. Invalid versions, token values, and conflicting scope identities fail before output; package code is never evaluated.

```ts
Graph.compile({
  contracts: { 'library/index.js': library.contracts['library/index.ts']! },
  imports: { 'app/card.ts': { '@acme/theme': 'library/index.js' } },
  modules: { 'app/card.ts': source },
})
```

### options.imports

- Type: `Readonly<Record<string, Readonly<Record<string, string | null>>>>`
- Default: Closed relative-source resolution.

Host-resolved static runtime imports, keyed by importing module ID and original specifier. Targets name supplied source modules or library contracts; `null` marks external imports. When supplied, every static runtime import/re-export must have an entry. Zyzz links theme contracts against these identities without implementing host aliases or package resolution.

The host owns dynamic imports when `imports` is supplied. Dynamic expressions remain in JavaScript and are excluded from this graph; the host must compile and load each lazy module and its CSS. Theme bindings used during compilation still require static imports.

```ts
Graph.compile({
  imports: {
    'app/card.ts': { '@theme': 'app/theme.ts' },
    'app/theme.ts': { zyzz: null },
  },
  modules,
})
```

### options.modules

- Type: `Readonly<Record<string, string>>`
- Required: Yes.

Complete source graph keyed by stable package-relative module IDs. Without `imports`, relative source imports resolve against supplied files, including `.js` to `.ts` / `.tsx` and extensionless/index paths. Ambiguous paths fail. Type-only imports do not create runtime dependencies; bare package and asset imports remain external.

```ts
Graph.compile({ modules: { 'app/card.ts': source } })
```

## Returns

### contracts

- Type: `Readonly<Record<string, string>>`

Compiler-only JSON for modules exporting themes or bound authoring aliases, including re-exports. Each file contains version 1 export bindings and complete graph theme data. Publish it beside the corresponding compiled runtime entrypoint as `<entry>.zyzz.json`; regenerate it together with JavaScript, declarations, and CSS.

```ts
output.contracts['library/index.ts'] // Publish as index.js.zyzz.json after lowering index.ts.
```

### dependencies

- Type: `Readonly<Record<string, readonly string[]>>`

Direct source and library-contract dependencies for each module.

```ts
output.dependencies['app/card.ts'] // ['app/theme.ts']
```

### modules

- Type: `Readonly<Record<string, Transform.compile.ReturnType>>`

Rewritten source, CSS, and maps per module. Load the graph's stylesheets together. Each consumer emits its live token paths for source scopes. Imported library contracts retain complete scopes, including tokens used only by precompiled components, so app extensions also affect those components. Scope rules can repeat between consumer stylesheets.

```ts
output.modules['app/card.ts']?.code
output.modules['app/card.ts']?.css
```

Scope and variable identities retain the defining module/binding. CSS maps trace source scope rules to their factory and declarations to the consuming style. Imported metadata scope rules are unmapped because their original source is not present. JavaScript/JSX lowering remains the consuming build's responsibility.

## Errors

`Source.ExtractError` or `Css.CompileError`; no partial result is returned. Missing modules, ambiguous exports, namespace theme imports, and static cycles are rejected. Dynamic source imports are rejected in standalone mode. Library authoring requires matching contract metadata; runtime JavaScript alone cannot supply token definitions.

## Configured Libraries

Named `Config.create` exports and bound aliases retain token and layer inference across source re-exports and packed declarations. Configuration metadata uses version 2; version 1 theme metadata remains readable. Publish matching JavaScript, declarations, CSS, and adjacent metadata from one build.

```ts
import { css, theme } from '@acme/theme'

export const styles = {
  card: css({ color: 'brand' }),
}
export const scope = theme.className
```

The graph normalizes configured themes without executing library code. Source edits invalidate dependent authoring and retain stable scope names. Layer emission and variants remain planned.

## Shared stylesheet delivery

When the graph has contributions, the result includes `sharedCss`, containing graph-wide layer declarations, global rules, font faces, and live keyframes. Load this stylesheet once, before the CSS from `modules`. Module CSS remains necessary for local styles. Recompile after source creation, updates, or deletion and replace both the shared stylesheet and affected module styles; contributions that disappear from the graph must also disappear from delivery. Vite handles this lifecycle automatically.
