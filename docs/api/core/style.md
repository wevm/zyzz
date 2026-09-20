# style

Define callable styles that compile to static CSS and styling props.

```ts
import { style } from 'zyzz'

namespace styles {
  export const card = style({ padding: '1rem' })
}
const props = styles.card({ style: { padding: '2rem' } })
```

## Signature

`style()`, `style(styles)`, or `style((values: { /* required scalar fields */ }) => styles)`

The callback overload requires an explicit finite object type and a concise static object body. It returns `style.Dynamic<values>`. Applying that callable requires every declared input and accepts optional `className`, `style`, and `variables` overrides, returning `style.Props`. The compiler emits fixed private custom properties; applications assign their values without generating rules. Private properties cannot be overridden through `style`. Empty strings remain explicit empty custom-property values.

```ts
const progress = style((values: { amount: `${number}%` }) => ({
  width: values.amount,
}))
const props = progress({ amount: '50%', className: 'external' })
```

## Target Branches

Static bodies accept `targets.web`, `targets.native`, `targets.ios`, and `targets.android`. Web output selects the web branch. Native compilation uses destination-specific property domains and explicit platform selection. See [target value semantics](../react-native/StyleSheet/README.md#target-branches). Native callable application remains pending.

Target declarations belong in static style bodies. Callback bodies cannot contain target branches. Nested target containers are rejected. An `undefined` target container, branch, or native object field is treated as omitted. Target-only styles retain content identities in CSS-only builds.

## Parameters

### styles

- Type: `Style.LiteralProperties`
- Default: `{}`.

Literal property object at the current source boundary. Omit it for an empty definition, including identity-only references in `selectors` objects.

```ts
style({ padding: '1rem' })
```

## Application Parameters

The returned callable accepts an optional `style.Options` object, defaulting to `{}`.

### options.className

- Type: `string`
- Default: `undefined`

External classes appended to the compiled class list.

```ts
styles.card({ className: 'external' })
```

### options.style

- Type: `style.Options["style"]`
- Default: `undefined`

React inline CSS values, including `CSSProperties`. Values may be strings, numbers, or `undefined`. Overrides pass through without token resolution or runtime CSS validation. HTML configurations retain CSS value types with explicit units. Authored definitions retain their stricter CSS types. Events, children, and accessibility props stay on the component.

```ts
styles.card({ style: { padding: '2rem' } })
```

### options.variables

- Type: `Readonly<Record<\`--${string}\`, string | number | undefined>>`
- Default: `undefined`

Inline custom-property assignments keyed by variable references. These merge into returned styles before explicit `style` overrides; private callback bindings remain authoritative. Input objects are not mutated. Computed keys cannot enforce individual variable domains in TypeScript.

```ts
styles.label({ variables: { [variables.accent]: 'blue' } })
```

## Returns

The returned callable produces `style.Props` when applied. `className` and `style` below belong to those applied props.

### Callable

- Type: `style.ReturnType` for literal objects; `style.Dynamic<values>` for callbacks

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

- Type: `style.Props["style"]`

Copied inline overrides when supplied. Other component props remain on the element.

```ts
props.style
```

## Errors

Untransformed calls throw an error whose `name` is `style.MissingTransformError`. This is a diagnostic name, not a constructor exported on `style`; it cannot be referenced as `style.MissingTransformError` for `instanceof`. Invalid source definitions produce source diagnostics; application inputs are checked by TypeScript without runtime validation.

## Dynamic Values

A callback with one explicitly typed finite parameter and a concise object body compiles to static rules and a value binder. Static declarations can accompany scalar reads and template expressions. Generated callables retain required input types across compiled exports.

```ts
const bar = style((values: { amount: `${number}%`; alpha: number }) => ({
  display: 'block',
  opacity: values.alpha,
  width: values.amount,
}))
bar({ amount: '50%', alpha: 0.8 })
```

All declared inputs are required and consumed. `className`, `style`, and `variables` remain styling overrides; unrelated keys are rejected by types, and generated private assignments take precedence over overrides. Callbacks never execute in generated application code.

The source boundary accepts inline finite scalar object types, module-local type aliases, interfaces, and compatible object intersections. Optional fields, imported or generic types, arbitrary calls, dynamic fallback entries, and dynamic rule structure are unsupported. Fixed nested conditions can contain dynamic values. Native bindings remain separate work.

Types: `style.ErrorType`, `style.Options`, `style.Props`, `style.ReturnType`, and `style.Dynamic<values>`. See [Style Components](../../guides/styling.md#style-components).

## Selectors and conditions

Scoped pseudo keys (`:hover`, `::before`) and explicit `&` selectors retain declaration inference at every depth. `@media`, `@container`, `@supports`, and `@starting-style` compile to native CSS nesting, preserving authored order and specificity. Raw syntax is checked by the source compiler.

```ts
import { Config, Vars } from 'zyzz'

const theme = Vars.define({
  breakpoints: { tablet: '48rem' },
  spacing: { gap: '1rem' },
})
const config = Config.create({ vars: theme })
const panel = config.style({
  padding: 'gap',
  ':hover': { opacity: 0.8 },
  '@media tablet': { display: 'grid' },
})
```

Threshold aliases support `>=tablet`, `<desktop`, and `tablet..desktop` (inclusive lower/exclusive upper). Named container aliases use `@container sidebar >=card` with declared `containerNames`. Raw named container queries remain available. Applications establish containment with standard `containerType`/`containerName` declarations. Thresholds resolve during compilation; changing a runtime scope cannot change them.

Use explicit selectors for application-owned data/ARIA states and ancestor/sibling relationships. `selectors` objects interpolate other `style` definitions. Core `Style.define` and global declarations reject relationship keys.

Dynamic private values cannot contain CSS-wide keywords (`initial`, `inherit`, `unset`, `revert`, or `revert-layer`), because those keywords would apply to the custom property itself. Numeric zero can accompany string dimension domains. Template substitutions inside quoted CSS strings are rejected; pass the complete quoted scalar as a slot value when authoring dynamic content.

Root and configured `style` helpers suggest common pseudo selectors and at-rule prefixes, plus CSS properties and values inside those conditions. At-rule prefixes require a complete query. Configured styles also suggest theme tokens inside those blocks.

### selectors

A literal map of scoped selector strings to nested declarations. Every selector requires an explicit `&`. Template keys can interpolate previously declared `style` definitions. See [selectors](selectors.md).

### variables

A literal map of computed `variable()` keys to static scalar assignments. It is also supported inside selectors and conditions. Inline assignments use the same `variables` property on the generated callable. See [variable](variable.md).
