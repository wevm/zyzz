# css

Define callable styles that compile to static CSS and styling props.

```ts
import { css } from 'zyzz'

namespace styles {
  export const card = css({ padding: '1rem' })
}
const props = styles.card({ style: { padding: '2rem' } })
```

## Signature

`css(style)` or `css((values: { /* required scalar fields */ }) => style)`

The callback overload requires an explicit finite object type and a concise static object body. It returns `css.Dynamic<values>`. Applying that callable requires every declared input and accepts optional `className` and `style` overrides, returning `css.Props`. The compiler emits fixed private custom properties; applications assign their values without generating rules. Private properties cannot be overridden through `style`. Empty strings remain explicit empty custom-property values.

```ts
const progress = css((values: { amount: `${number}%` }) => ({
  width: values.amount,
}))
const props = progress({ amount: '50%', className: 'external' })
```

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

- Type: `css.ReturnType` for literal objects; `css.Dynamic<values>` for callbacks

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

Untransformed calls throw an error whose `name` is `css.MissingTransformError`. This is a diagnostic name, not a constructor exported on `css`; it cannot be referenced as `css.MissingTransformError` for `instanceof`. Invalid source definitions produce source diagnostics; application inputs are checked by TypeScript without runtime validation.

## Dynamic Values

A callback with one explicitly typed finite parameter and a concise object body compiles to static rules and a value binder. Static declarations can accompany scalar reads and template expressions. Generated callables retain required input types across compiled exports.

```ts
const bar = css((values: { amount: `${number}%`; alpha: number }) => ({
  display: 'block',
  opacity: values.alpha,
  width: values.amount,
}))
bar({ amount: '50%', alpha: 0.8 })
```

All declared inputs are required and consumed. `className` and `style` remain styling overrides; unrelated keys are rejected by types, and generated private assignments take precedence over overrides. Callbacks never execute in generated application code.

The source boundary accepts inline finite scalar object types, module-local type aliases, interfaces, and compatible object intersections. Optional fields, imported or generic types, arbitrary calls, dynamic fallback entries, and dynamic rule structure are unsupported. Fixed nested conditions can contain dynamic values. Native bindings remain separate work.

Types: `css.ErrorType`, `css.Options`, `css.Props`, `css.ReturnType`, and `css.Dynamic<values>`. See [Style Components](../../guides/styling.md#style-components).

## Selectors and conditions

Scoped pseudo keys (`:hover`, `::before`) and explicit `&` selectors retain declaration inference at every depth. `@media`, `@container`, `@supports`, and `@starting-style` compile to native CSS nesting, preserving authored order and specificity. Raw syntax is checked by the source compiler.

```ts
const theme = Theme.define({
  breakpoints: { tablet: '48rem' },
  spacing: { gap: '1rem' },
})
const panel = theme.css({
  padding: 'gap',
  ':hover': { opacity: 0.8 },
  '@media tablet': { display: 'grid' },
})
```

Threshold aliases support `>=tablet`, `<desktop`, and `tablet..desktop` (inclusive lower/exclusive upper). Named container aliases use `@container sidebar >=card` with declared `containerNames`. Raw named container queries remain available. Applications establish containment with standard `containerType`/`containerName` declarations. Thresholds resolve during compilation; changing a runtime scope cannot change them.

Use explicit selectors for application-owned data/ARIA states and ancestor/sibling relationships. `where` relationships between css definitions compile in web `css` definitions. Core `Style.define` and global declarations reject relationship keys.

Dynamic private values cannot contain CSS-wide keywords (`initial`, `inherit`, `unset`, `revert`, or `revert-layer`), because those keywords would apply to the custom property itself. Numeric zero can accompany string dimension domains. Template substitutions inside quoted CSS strings are rejected; pass the complete quoted scalar as a slot value when authoring dynamic content.
