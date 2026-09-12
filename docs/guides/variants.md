# Variants

Define finite choices, defaults, and compound matches for one element. Begin with [Getting Started](../introduction/getting-started.md) to connect compilation.

## Recipes

### Define Variants

Add typed choices to a component. This example imports `{ variants }` from the [theme config](themes.md#use-themes); import from `zyzz` for token-free recipes.

> [!NOTE]
> Preview API; not yet implemented.

```tsx
import { variants } from './zyzz.config.js'

namespace style {
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

type ButtonOptions = NonNullable<Parameters<typeof style.button>[0]>
const example = <button {...style.button({ size: 'md' })}>Save</button>
```

Each recipe returns props for one element. Defaults apply to omitted selections; null suppresses a choice and its default. Compounds combine matching choice names. Finite choices compile ahead of time.
