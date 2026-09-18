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
      export namespace styles {
        export const card = theme.style({ color: 'brand' })
      }
    `,
  },
})
```

For repeated edits, [Graph.create](create.md) retains an isolated incremental cache. `Graph.compile` always starts fresh.

## Parameters

### options.development

- Type: `boolean`
- Default: `false`

Use stable atomic declaration names for CSS-only development updates. Production output uses readable literal values with module ownership hashes. Vite selects development naming automatically.

```ts
Graph.compile({ development: true, modules })
```

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

### options.native

- Type: Native compilation context with required `colorScheme`.
- Default: Web output.

Compile source and packed static callables into native style props. `platform`, `themes`, `theme`, `fonts`, and `units` follow [native source compilation](../Native.md). Native output contains module code, maps, contracts, and dependencies, with empty CSS and class metadata. Source rewriting is required.

## Returns

### contracts

- Type: `Readonly<Record<string, string>>`

Compiler-only JSON for modules exporting themes or bound authoring aliases, including re-exports. Each file contains versioned export bindings and complete graph theme data. Publish it beside the corresponding compiled runtime entrypoint as `<entry>.zyzz.json`; regenerate it together with JavaScript, declarations, and CSS.

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

Scope and variable identities retain the defining module/binding. CSS maps trace source scope rules to their factory and declarations to the consuming styles. Imported metadata scope rules are unmapped because their original source is not present. JavaScript/JSX lowering remains the consuming build's responsibility.

### sharedCssMap

Type: `EncodedSourceMap | undefined`. Maps the combined shared stylesheet to its source-owned and packed contributions. Present with nonempty shared CSS; source content is retained when published by its owner.

```ts
import * as fs from 'node:fs/promises'

if (output.sharedCssMap)
  await fs.writeFile('zyzz.shared.css.map', JSON.stringify(output.sharedCssMap))
```

### sharedAssets

Type: `Readonly<Record<string, string>> | undefined`. Maps compiler URL placeholders to portable asset targets. The host resolves and publishes those targets, then rewrites matching placeholders in shared CSS.

```ts
for (const [placeholder, target] of Object.entries(output.sharedAssets ?? {}))
  console.log(placeholder, target)
```

### sharedAssetOwners

Type: `Readonly<Record<string, string>> | undefined`. Maps each asset placeholder to its trusted source or declaring contract identity. Hosts use that identity to enforce package-root ownership, including repacked dependencies.

```ts
for (const placeholder of Object.keys(output.sharedAssets ?? {}))
  console.log(output.sharedAssetOwners?.[placeholder])
```

## Errors

`Source.ExtractError` or `Css.CompileError`; no partial result is returned. Missing modules, ambiguous exports, namespace theme imports, and static cycles are rejected. Dynamic source imports are rejected in standalone mode. Library authoring requires matching contract metadata; runtime JavaScript alone cannot supply token definitions.

## Configured Libraries

Named `Config.create` exports and bound aliases retain token and layer inference across source re-exports and packed declarations. Configuration metadata uses version 2; version 1 theme metadata remains readable. Publish matching JavaScript, declarations, CSS, and adjacent metadata from one build.

```ts
import { style, theme } from '@acme/theme'

export namespace styles {
  export const card = style({ color: 'brand' })
}
export const scope = theme.className
```

The graph normalizes configured themes without executing library code. Source edits invalidate dependent authoring and retain stable scope names. Root and config-bound variants compile through source graphs and packed contracts.

## Shared stylesheet delivery

When the graph has contributions, the result includes `sharedCss`, containing graph-wide layer declarations, global rules, font faces, and live keyframes. Load this stylesheet once, before the CSS from `modules`. Module CSS remains necessary for local styles. Recompile after source creation, updates, or deletion and replace both the shared stylesheet and affected module styles; contributions that disappear from the graph must also disappear from delivery. Vite handles this lifecycle automatically.

Packed contracts containing query metadata or typography groups use schema version 3. Existing scalar-only theme contracts retain version 1, and scalar-only configuration contracts retain version 2. Readers accept implemented schema versions and reject unknown future versions explicitly.

Composite CSS function signatures, added scalar primitives, and newly written namespace metadata use version 11. Namespace metadata supports escaped/Unicode prefixes, repeated bindings, and control-character URI transport. Legacy scalar functions retain version 10; existing version-10 namespace libraries remain readable.

The writer selects the lowest version required by the exported capabilities:

| Version | Added capability                                     |
| ------- | ---------------------------------------------------- |
| 1       | Theme bindings                                       |
| 2       | Configuration and bound aliases                      |
| 3       | Queries and typography                               |
| 4       | Callable theme selection and initialization script   |
| 5       | Property mappings                                    |
| 6       | Marker relationships                                 |
| 7       | Packed stylesheets and animation identities          |
| 8       | Variable references and registered custom properties |

This reader accepts versions 1–8. Publish metadata together with its matching runtime entrypoint, declarations, stylesheets, assets, and maps.

`sharedAssetOwners` associates each relocated URL placeholder with its trusted source or packed-contract identity. Hosts validate package ownership before serving or publishing assets. Conflicting packed sections raise `Source.ExtractError` attributed to the contributing contract.

Compile independent libraries with package-qualified module IDs (the file host supplies these from `packageId`). Packed variable sidecars retain their canonical defining module, so multiple package entrypoints can share one contract. The graph rejects accidental slot collisions between distinct defining modules and conflicting schemas for one ref identity. Bare contract IDs provide no package provenance and remain isolated; package-qualified IDs are required for multi-entry sharing.

Repacked stylesheet sections retain an import chain to their declaring contract. Hosts must supply each chain edge in `imports` and its adjacent sidecar in `contracts`; Vite resolves and watches these dependencies recursively, including nested package installations. Asset validation uses the declaring package root. Source content and offsets participate in packed contribution conflict checks, and each sidecar validates its layer constraints before rendering.

Importing `zyzz/reset.css` adds reset-first layer constraints to shared CSS and packed output. Conflicting configured orders fail compilation. Packed animations and variable slots must have nonconflicting identities; package-qualified source module IDs prevent independent libraries from generating the same private names.
