# Variants

Define finite choices, defaults, and compound matches for one element. Begin with [Getting Started](../introduction/getting-started.md) to connect compilation.

## Recipes

### Define Variants

Add typed choices to a component. This example imports `{ variants }` from the [theme config](themes.md#use-themes). Import from `zyzz` for token-free recipes.

```tsx
import { variants } from './zyzz.config.js'

namespace styles {
  export const button = variants({
    base: { display: 'inline-flex' },
    compoundVariants: [{ style: { fontWeight: 600 }, when: { size: 'md' } }],
    defaultVariants: { size: 'sm' },
    variants: {
      size: {
        md: { padding: 'md' },
        sm: { padding: 'sm' },
      },
    },
  })
}

type ButtonOptions = NonNullable<Parameters<typeof styles.button>[0]>
const example = <button {...styles.button({ size: 'md' })}>Save</button>
```

Each variant definition returns props for one element. Defaults apply to omitted selections, and null suppresses a choice and its default. Compounds combine matching choice names. Finite choices compile ahead of time.

Compile libraries before publishing and include the generated `.zyzz.json` contracts and stylesheets. Packed definitions preserve all finite choices, conditional selections, payload slots, defaults, and compounds. Destructured configured factories emit portable TypeScript declarations, so downstream callers keep choice and payload inference without library sources.
