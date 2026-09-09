# Theme

Immutable scalar tokens and compatible extensions.

```ts
import { Theme } from 'zyzz'
```

## Methods

| API                       | Description                                                             |
| ------------------------- | ----------------------------------------------------------------------- |
| [Theme.define](define.md) | Define immutable scalar tokens and portable references.                 |
| [Theme.extend](extend.md) | Create compatible token overrides without changing the base definition. |

## Application

[Call a theme](apply.md) to spread its scope and optional color scheme onto `<html>` or a subtree. Metadata and bound authoring members remain accessible.

## Types and Errors

`Color`, `Css`, `Definition`, `Overrides`, `Palette`, `Reference`, `References`, `Tokens`; `InvalidError`.

See the [public declarations](../../../../src/Theme.ts) for complete generic signatures and documented type properties.
