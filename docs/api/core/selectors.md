# selectors

Group scoped CSS selectors inside a `style` definition.

```ts
import { style } from 'zyzz'

namespace styles {
  export const card = style()
  export const label = style({
    color: 'gray',
    selectors: {
      '&:hover': { color: 'black' },
      '&:nth-child(even)': { opacity: 0.5 },
      '[data-state="open"] &': { color: 'blue' },
      [`${card}:hover &`]: { color: 'red' },
    },
  })
}
```

## Keys

- Type: Literal strings or template strings referencing `style` definitions.
- Required: An explicit `&` target in every selector-list branch.

`&` identifies the styled element. Templates interpolate previously declared definitions without calling them. Empty `style()` definitions supply identity without declarations. Apply referenced definitions through their ordinary styling props.

## Values

- Type: Nested style declaration objects.

Declarations retain CSS and configured-token inference. Nested `variables`, selectors, and conditional at-rules preserve authored order. The source compiler parses selector syntax and resolves local, imported, aliased, and packed style identities without runtime selector construction.

## Specificity

Specificity follows the authored selector. Use explicit `:where(...)` to lower it. State remains in ordinary data and ARIA attributes. Strings cannot statically prove DOM structure or attribute existence.

Dynamic callback values require selectors targeting the styled element because their private variables live on that element. Core `Style.define` and global declarations do not support this compiler-owned grouping property.

This property replaces the `selectors` tagged-template function. Existing direct pseudo and conditional at-rule keys remain supported.
