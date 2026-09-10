# css

Define callable styles that compile to static CSS and styling props.

```ts
import { css } from 'zyzz'

const styles = {
  card: css({ padding: '1rem' }),
}
const props = styles.card({ style: { padding: '2rem' } })
```

## Signature

`css(style)`

## Parameters

### style

- Type: `Style.LiteralProperties`
- Required: Yes.

Literal property object at the current source boundary.

```ts
css({ padding: '1rem' })
```

## Application Parameters

The returned callable accepts an optional `css.Options` object, defaulting to `{}`.

### options.className

- Type: `string`
- Default: `undefined`

External classes appended to the compiled class list.

```ts
styles.card({ className: 'external' })
```

### options.style

- Type: `css.Options["style"]`
- Default: `undefined`

Literal inline overrides. Events, children, and accessibility props stay on the component.

```ts
styles.card({ style: { padding: '2rem' } })
```

## Returns

The returned callable produces `css.Props` when applied. `className` and `style` below belong to those applied props.

### Callable

- Type: `css.ReturnType`

Callable producing styling props. Static no-argument applications may fold to constants.

```ts
const props = styles.card({ style: { padding: '2rem' } })
```

### className

- Type: `string`

Generated class list, including supplied external classes. Class-string order does not establish CSS precedence.

```ts
props.className
```

### style

- Type: `css.Props["style"]`

Copied inline overrides when supplied. Other component props remain on the element.

```ts
props.style
```

## Errors

Untransformed calls throw an error whose `name` is `css.MissingTransformError`. This is a diagnostic name, not a constructor exported on `css`; it cannot be referenced as `css.MissingTransformError` for `instanceof`. Invalid source definitions produce source diagnostics; invalid applied override shapes throw `TypeError`.

> [!NOTE]
> Config-bound extraction, conditions, broad values, and `css((values: Values) => style)` are previews. Callback inputs bind to fixed CSS variables; unknown inputs fail.

Types: `css.ErrorType`, `css.Options`, `css.Props`, and `css.ReturnType`. See [Style Components](../../guides/styling.md#style-components).
