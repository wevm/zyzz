# Global Styles

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

Use [Cascade Layers](layers.md) to define ordering and [Fonts and Motion](motion.md) for other stylesheet contributions.
