# style

Define static CSS and apply it through the JSX `style` prop. Static definitions are values, without a call at the application site.

```tsx
import { style } from 'zyzz'

const styles = {
  button: style({ color: '#06c', padding: '1rem' }),
}

const example = <button style={styles.button}>Continue</button>
```

## Signature

`style(declarations): style.ReturnType`

## Parameters

### declarations

- Type: `Style.LiteralProperties`
- Required: Yes.

Literal CSS declarations, including supported ordered fallback arrays and trailing `!` importance. Config-bound helpers infer theme tokens. Unknown properties and invalid values produce type errors and source diagnostics.

```ts
style({ display: ['block', 'flex'], color: '#06c!' })
```

## Returns

### Value

- Type: `style.ReturnType`

An opaque, immutable style value compatible with React's `style` prop. The compiler emits static CSS and consumes its class metadata at intrinsic JSX elements. Ordinary inline styles retain native behavior.

```tsx
<button className="external" style={{ ...styles.button, opacity: 0.5 }} />
```

External classes are appended. Inline declarations override normal stylesheet declarations according to the CSS cascade. Object spread supports one compiled value plus inline overrides; it does not compose multiple compiled definitions.

Custom components can forward `style` or their complete props to an intrinsic element processed by Zyzz. Uncompiled third-party components need an adapter; see [Forward Styles](../../guides/styling.md#forward-styles).

## Errors

Untransformed authoring throws `style.MissingTransformError`. Unsupported source forms fail with source diagnostics. Static values cannot be called.

Types: `style.ErrorType` and `style.ReturnType`.

Dynamic callbacks, conditions, and variants remain previews. Their proposed applications use the same `style` prop; static values and literal inline overrides are implemented.
