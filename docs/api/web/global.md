# global

> [!NOTE]
> Initial compiler support: direct named imports and module-level literal calls.

Contribute eager global selectors and nested grouping rules.

Declare stylesheet descriptors through dedicated functions such as [`page` and `counterStyle`](at-rules.md). `global` accepts selectors and grouping rules, not descriptor or statement declarations.

```ts
import { global } from 'zyzz/web'

global({ '@layer base': { body: { margin: 0 } } })
```

## Signature

`global(definition)`

## Parameters

### definition

- Type: Static selector maps and nested stylesheet rules
- Required: Yes.

Module-level selectors and supported at-rules. Discovery includes configured unimported modules.

```ts
global({ '@layer base': { body: { margin: 0 } } })
```

## Returns

Creates a retained stylesheet effect independent of JavaScript export usage. Watching replaces or removes contributions with their sources. The call is erased and returns no runtime object.

## Errors

Reject invalid selectors, declarations, at-rules, and order cycles. Raw global layer names have no ambient config inference.

See [Fonts and Motion](../../guides/stylesheets.md#fonts-and-motion) and [Global Styles](../../guides/stylesheets.md#global-styles).

## Current compiler boundary

Direct named imports from `zyzz/web` compile to static stylesheet data. `global`, `fontFace`, and `layers` are eager across supplied graph modules. Vite scans physical project source under its root, excluding generated directories, tests, and dependencies; the standalone host scans its configured source tree. `Graph.compile` returns one `sharedCss` artifact, and the standalone host writes `zyzz.shared.css`, loaded before module stylesheets. Vite imports one shared virtual stylesheet automatically.

Local keyframes use stable module-and-binding names; unused local definitions are omitted and exported names remain live. Imported and re-exported animations retain their identity through packed metadata. Relative URLs resolve against the contributing source; Node publishes assets and Vite handles their production URLs. Shared CSS includes source maps and packed contributions. Opt into the reset with `import 'zyzz/reset.css'`.

## Static values

Global declarations accept immutable local values and literal exports from modules in the source graph, including typography objects. Type-only references do not affect static extraction. Mutations and runtime calls remain unsupported.

```ts
import { global } from 'zyzz/web'
import { tokens } from './tokens.js'

global({
  body: { fontFamily: tokens.fontFamily.sans },
  button: tokens.typography.button['16'],
})
```

Include the token source module in the graph. Packed library contracts do not expose arbitrary constant exports.
