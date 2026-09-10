# Stylesheets

Declare global rules, cascade order, fonts, and animations. Begin with [Getting Started](../introduction/getting-started.md) to connect compilation.

## Recipes

### Global Styles

> [!NOTE]
> Preview API; not yet implemented.

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

> [!NOTE]
> Preview API; not yet implemented.

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

const styles = {
  card: css({ '@layer components': { padding: '1rem' } }),
}
```

Global modules may contribute rules independently. Their raw layer names receive compiler validation without ambient config inference.

```ts
import { global } from 'zyzz/web'

global({ '@layer base': { body: { margin: 0 } } })
```

The initial bundle contains the shared layer prelude. Conflicting order constraints fail; unlayered rules and important declarations retain standard CSS precedence. See [Global Styles](stylesheets.md#global-styles) for collection behavior.

### Fonts and Motion

> [!NOTE]
> Preview API; not yet implemented.

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
const styles = {
  notice: css({
    animationDuration: '160ms',
    animationName: enter,
    fontFamily: '"App Sans", sans-serif',
    '@media (prefers-reduced-motion: reduce)': { animationName: 'none' },
  }),
}
```

Font URLs retain source ownership. Reachable keyframes emit stable references. Frame bodies contain declarations only; no importance or nested selectors/queries. Native font loading and animations require platform-specific behavior.
