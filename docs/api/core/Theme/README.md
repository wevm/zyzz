# Theme

Immutable scalar tokens and compatible extensions. Optional `margin` and `padding` scales override `spacing` for their corresponding physical and logical properties; margin permits signed lengths, while padding is nonnegative. See [Theme.define](define.md#tokensmargin).

```ts
import { Theme } from 'zyzz'
```

## Methods

| API                       | Description                                                             |
| ------------------------- | ----------------------------------------------------------------------- |
| [Theme.define](define.md) | Define immutable scalar tokens and portable references.                 |
| [Theme.extend](extend.md) | Create compatible token overrides without changing the base definition. |

## Variables

`theme.vars` exposes readonly, property-aware web references with defining fallbacks. Direct declaration values and template interpolations retain inherited theme overrides, including light/dark pairs. Source imports, theme aliases, config members, and packed theme contracts preserve identity.

```ts
const panel = theme.css({
  color: theme.vars.color.brand,
  width: `calc(100% - ${theme.vars.spacing.md})`,
})
```

Variable paths must appear inside compiled declarations. Standalone variable destructuring and runtime string coercion are not supported. Portable `theme.tokens` remains separate from web variable references.

## Application

[Call a theme](apply.md) to spread its scope and optional color scheme onto `<html>` or a subtree. Metadata and bound authoring members remain accessible.

## Types and Errors

`Color`, `Css`, `Definition`, `Overrides`, `Palette`, `Reference`, `References`, `Tokens`; `InvalidError`.

See the [public declarations](../../../../src/Theme.ts) for complete generic signatures and documented type properties.

## Typography and queries

Scalar `fontFamily`, `fontSize`, `fontWeight`, `letterSpacing`, and `lineHeight` groups retain property-specific inference and inherited variables. `breakpoints`, `containers`, and `containerNames` are separate compile-time metadata; they never become declaration variables. See the opt-in [default theme](../../themes/default.md).

Container aliases compile to literal width conditions. An unnamed alias queries the nearest ancestor with eligible containment; a named alias queries the nearest ancestor carrying that `containerName`. `containerNames` validates alias names only; raw parenthesized queries keep any name, and containment stays an application declaration. See [Container Selection](../../../guides/conditions.md#container-selection).
