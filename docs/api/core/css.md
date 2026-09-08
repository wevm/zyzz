# css

Define callable styles that compile to static CSS and styling props.

```ts
import { css } from 'zyzz'

const card = css({ padding: '1rem' })
const props = card({ style: { padding: '2rem' } })
```

## Signature

`css(style)`

## Parameters

- `style`: a literal property object at the current boundary.
- Applied `className`: optional external classes.
- Applied `style`: optional literal inline overrides; other component props stay on the component.

## Returns

`css.ReturnType`: a callable producing `css.Props` with `className` and optional `style`. Static no-argument applications may fold to constants.

## Errors

Untransformed calls throw `css.MissingTransformError`. Invalid source definitions produce source diagnostics; invalid applied override shapes throw `TypeError`.

> [!NOTE]
> Config-bound extraction, conditions, broad values, and `css((values: Values) => style)` are previews. Callback inputs bind to fixed CSS variables; unknown inputs fail.

Types: `css.ErrorType`, `css.Options`, `css.Props`, and `css.ReturnType`. See [Style Components](../../guides/styling.md).
