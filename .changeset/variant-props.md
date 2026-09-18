---
"zyzz": patch
---

Added `Props.Variants` to infer variant selections and styling overrides from a recipe.

```ts
import type { Props } from 'zyzz'

type ButtonProps = Props.Variants<typeof styles.button>
```
