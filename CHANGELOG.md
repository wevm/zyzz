# zyzz

## 0.0.3

### Patch Changes

- 0c6c948: Added nested typography theme sets to `zyzz/default`.
  
  ```ts
  import { style } from 'zyzz/default'
  
  namespace styles {
    export const title = style({ typography: 'heading.32' })
    export const code = style({ typography: 'label.14.mono' })
  }
  ```

## 0.0.2

### Patch Changes

- 2d051ce: Restricted important values to the `<value> !important` syntax in types and runtime validation.
- 634da64: Replaced `zyzz/themes/default` with `zyzz/default`, exporting the bundled configuration's appearance controls, initialization script, theme, authoring helpers, and raw tokens.
  
  ```ts
  import {
    appearance,
    script,
    style,
    theme,
    tokens,
    variants,
  } from 'zyzz/default'
  ```
- 3fd7de0: Fixed CSS value and theme token autocomplete for config-bound styles.
- 5b598c9: Improved style property and value suggestions, error locations, and type-checking performance.
- 78bcb37: Added `Props.Variants` to infer variant selections and styling overrides from a recipe.
  
  ```ts
  import type { Props } from 'zyzz'
  
  type ButtonProps = Props.Variants<typeof styles.button>
  ```

## 0.0.1

### Patch Changes

- 0a928f8: Initial release
