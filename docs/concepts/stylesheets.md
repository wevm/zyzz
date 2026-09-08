# Layers and Stylesheets

> [!NOTE]
> Preview API; not yet implemented.

```ts
import { global } from 'zyzz/web'

// Layer order comes from config or Css.layers.
global({ '@layer base': { body: { margin: 0 } } })
```

- **Collection:** scans configured sources, including unimported modules; excludes tests, generated output, and dependencies by default.
- **Delivery:** globals are eager, including declarations beside lazy components. The initial stylesheet includes the shared layer prelude.
- **Helpers:** import `fontFace`, `global`, and `keyframes` directly. Keyframes have separate reachability rules.
- **Ordering:** constraints merge deterministically; cycles produce located errors. Preserve authored order, unlayered rules, and important reversal.
- **Watching:** edits and deletions replace or remove contributions; relative assets retain source ownership.

See [stylesheet usage](../guides/stylesheets.md) for fonts and motion. Standalone globals do not widen a config's inferred layer names.
