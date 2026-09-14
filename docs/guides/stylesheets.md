# Stylesheets

Declare global rules, cascade order, fonts, and animations. Begin with [Getting Started](../introduction/getting-started.md) to connect compilation.

## At-Rule Functions

> [!NOTE]
> The following helpers are planned. See the [complete API proposal](../api/web/at-rules.md) for signatures, reference behavior, and remaining design gates.

Declare stylesheet rules through direct functions:

```ts
import { page, positionTry, viewTransition } from 'zyzz/web'

export const above = positionTry({
  positionArea: 'top',
  marginBottom: '0.5rem',
})

page({
  descriptors: {
    size: 'A4',
    margin: '2cm',
    '@bottom-center': { content: 'counter(page)' },
  },
})

viewTransition({ navigation: 'auto' })
```

Named helpers return typed references, following `keyframes`. For example, `above` becomes a `positionTryFallbacks` value. Repeated calls preserve distinct stylesheet rules; helper calls compile away.

Use `global` for global selectors and nested grouping. Keep `@media`, `@supports`, `@container`, `@scope`, `@starting-style`, and declared `@layer` keys in valid style bodies. Expanded grammar remains part of the proposal.

## Recipes

### Global Styles

Declare global rules at module scope in a configured project source. A component import is not required for collection.

```ts
import { global } from 'zyzz/web'

global({
  '@layer base': { body: { margin: 0 } },
})
```

- **Collection:** scans configured project sources; excludes tests, generated output, and dependencies by default.
- **Delivery:** globals are eager effects, even beside lazy components.
- **Layers:** raw names receive compiler validation, without ambient TypeScript config inference.
- **Watching:** updates and deletions replace or remove their contributions.

Use [Cascade Layers](stylesheets.md#cascade-layers) to define ordering and [Fonts and Motion](stylesheets.md#fonts-and-motion) for other stylesheet contributions.

### Cascade Layers

Declare layer order once in config. Bound styles infer the exact layer names.

```ts
// zyzz.config.ts
import { Config } from 'zyzz'

export const { css } = Config.create({
  layers: ['reset', 'base', 'components'],
})
```

```ts
import { css } from './zyzz.config.js'

namespace styles {
  export const card = css({ '@layer components': { padding: '1rem' } })
}
```

Global modules may contribute rules independently. Their raw layer names receive compiler validation without ambient config inference.

```ts
import { global } from 'zyzz/web'

global({ '@layer base': { body: { margin: 0 } } })
```

The initial bundle contains the shared layer prelude. Conflicting order constraints fail; unlayered rules and important declarations retain standard CSS precedence. See [Global Styles](stylesheets.md#global-styles) for collection behavior.

### Fonts and Motion

Declare fonts and keyframes near their owning code. Disable nonessential motion when reduced motion is requested.

```ts
import { css } from 'zyzz'
import { fontFace, keyframes } from 'zyzz/web'

fontFace({
  fontDisplay: 'swap',
  fontFamily: 'App Sans',
  src: 'url("./app.woff2") format("woff2")',
})
const enter = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
namespace styles {
  export const notice = css({
    animationDuration: '160ms',
    animationName: enter,
    fontFamily: '"App Sans", sans-serif',
    '@media (prefers-reduced-motion: reduce)': { animationName: 'none' },
  })
}
```

Font URLs retain source ownership. Reachable keyframes emit stable references. Frame bodies contain declarations only; no importance or nested selectors/queries. Native font loading and animations require platform-specific behavior.

### Optional Reset

```ts
import 'zyzz/reset.css'
```

The reset lives in the `reset` layer: border-box sizing, zeroed margins and padding, unstyled headings, links, and lists, inherited form-control typography, and block-level replaced elements. Its document and code font stacks are system fallbacks, so the [default theme](../api/themes/default.md) `fontFamily` tokens still select the bundled faces explicitly. Core imports do not install it. Ordinary unlayered declarations take precedence regardless of whether the reset loads before or after them.

### Packed Libraries

Publish generated `.zyzz.json` sidecars alongside their compiled entrypoints. They retain global contributions, fonts, keyframes, and layer constraints through imports and re-exports. Shared source maps retain the original authoring content. Identical source contributions emit once; conflicting copies fail compilation.

Relative URLs resolve from their owning module. The standalone host copies referenced assets into the output tree and tracks their ownership and updates. Vite resolves the same assets through its CSS pipeline and watches their source files. Keep the emitted asset tree with packed modules and metadata.
