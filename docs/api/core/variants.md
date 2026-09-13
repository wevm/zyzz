# variants

Defines one element's finite style choices. Import `variants` from `zyzz`; apply the returned callable through ordinary styling props.

```tsx
import { variants } from 'zyzz'

namespace styles {
  export const button = variants({
    base: { display: 'inline-flex' },
    variants: {
      size: { sm: { padding: '4px' }, lg: { padding: '12px' } },
      loading: { true: { opacity: 0.5 }, false: {} },
    },
    defaultVariants: { size: 'sm', loading: false },
    compoundVariants: [
      { when: { size: ['sm', 'lg'], loading: true }, style: { color: 'red' } },
    ],
  })
}

const button = <button {...styles.button({ size: 'lg', loading: true })} />
type ButtonProps = NonNullable<Parameters<typeof styles.button>[0]>
```

The compiler emits every finite choice and compound. Applications select attributes under a stable class, merge styling overrides, and never generate CSS. Runtime selection relies on the typed contract; structural authoring errors produce source diagnostics during compilation.

## Definition

### base

Type: static style object. Default: `{}`. Applied before choices and compounds.

```ts
variants({ base: { display: 'flex' } })
```

### variants

Type: an ordered record of axes, each containing named static style objects. Default: `{}`. Boolean choice names `true` and `false` produce boolean selection inputs.

```ts
variants({
  variants: { size: { sm: { padding: '4px' }, lg: { padding: '12px' } } },
})
```

### defaultVariants

Type: optional choices for declared axes. Default: `{}`. Omitted and `undefined` inputs use defaults; `null` suppresses them.

```ts
variants({ variants: { size: { sm: {} } }, defaultVariants: { size: 'sm' } })
```

### compoundVariants

Type: an ordered array of `{ when, style }` objects. Default: `[]`. Arrays within `when` match any listed choice; different axes must all match.

```ts
variants({
  variants: { size: { sm: {}, lg: {} } },
  compoundVariants: [{ when: { size: ['sm', 'lg'] }, style: { color: 'red' } }],
})
```

Precedence is base, then axes in declaration order, then compounds in array order, within matching contexts and importance. Attributes add no selector specificity. Axis names use lowercase data-attribute spelling and cannot reuse styling or component-reserved props.

## Application

`styles.button()` applies defaults. A `null` selection suppresses an axis and its default. Boolean `false` emits `"false"`; it does not remove the attribute. Styling overrides use `className`, `style`, and `variables`, as with `css`.

Each recipe owns its emitted `data-*` attributes. Multipart components use separate definitions and shared component inputs. There is no multipart `slots` option; dynamic choices bind fixed CSS-variable slots. Ordinary JSX spreads replace props; they are not a composition API.

> [!NOTE]
> Explicit props composition follows in the Phase 3 stack.

## Conditional Selections

Declare named conditions on the recipe and select overrides separately from base choices:

```ts
const button = variants({
  conditions: {
    wide: '@media (width >= 600px)',
    reduced: '@media (prefers-reduced-motion: reduce)',
  },
  variants: {
    size: { sm: { padding: '4px' }, lg: { padding: '12px' } },
    animated: { true: { transition: 'opacity 200ms' }, false: {} },
  },
  defaultVariants: { size: 'sm', animated: true },
})

button({ conditions: { wide: { size: 'lg' }, reduced: { animated: false } } })
```

Conditions support `@media` and `@supports`. Bound recipes also accept their theme's media aliases, such as `@media >=md`. Container and selector conditions are not supported for selection yet; ordinary declarations inside each choice retain their existing conditional capabilities.

Later matching conditions win independently for each axis, in recipe declaration order. Missing or `undefined` overrides inherit the earlier effective selection. `null` disables the axis, including its default. Compounds match effective choices. Switching choices removes declarations unique to the previous choice, allowing base styles and the normal cascade to apply.

CSS evaluates the conditions. Recipe calls serialize base and conditional instructions into attributes; they do not inspect the viewport, install listeners, or create CSS. These attributes carry selections, not a live reflection of the currently matching media query. SSR and client calls produce the same props for the same input.

Compilation partitions condition states to preserve null and overlap semantics. Each recipe supports up to eight named conditions, producing at most 256 regions before ordinary CSS emission. Output grows with conditions and authored choices/compounds; runtime values do not grow it. The `zyzz-condition-` axis prefix is reserved for generated attributes.

Media-list complements follow [Media Queries Level 4](https://www.w3.org/TR/mediaqueries-4/#mq-not): inactive comma-separated alternatives become intersected negated queries.

## Returns

A callable accepting optional declared selections and styling overrides. Infer its input with `NonNullable<Parameters<typeof styles.button>[0]>`.

### className

Type: `string`. The stable generated recipe class, with any supplied `className` appended.

```ts
styles.button({ className: 'external' }).className
```

### style

Type: an optional inline style record. Includes supplied inline overrides and custom variable assignments; defaults to absent.

```ts
styles.button({ style: { opacity: 0.5 } }).style
```

### data attributes

Type: optional `string` properties named `data-${axis}` for declared axes. Defaults and selected choices are serialized; suppressed axes are omitted.

```ts
styles.button({ size: 'lg' })['data-size']
```

## Errors

Executing untransformed authoring throws `variants.MissingTransformError`. Compilation reports unsupported structures and invalid authored selections at their source locations. Static types reject invalid application inputs; runtime selection performs no validation.

## Bound aliases

Bound aliases and re-exports retain their contracts through source graphs and packed libraries. Packed recipe-authoring aliases require version 15 metadata; older consumers must upgrade to read that contract. Existing CSS-only contracts retain their earlier versions.

Theme helpers can share a module-level `const` destructuring declaration, including renamed bindings:

```ts
import { Theme } from 'zyzz'

const theme = Theme.define({ color: { brand: '#06c' } })
const { css: style, variants: recipe } = theme
export { style, recipe }
```

Both helpers keep their own token-aware signatures through aliases and re-exports. Destructuring defaults, rest properties, computed keys, and nested patterns produce source diagnostics.

## Dynamic Choices

Typed callbacks declare fixed CSS-variable bindings. Select a dynamic choice with one scoped payload; a bare dynamic choice name is invalid.

```ts
namespace styles {
  export const button = variants({
    variants: {
      size: {
        sm: { padding: '4px' },
        custom: (values: { padding: `${number}px` }) => ({
          padding: values.padding,
        }),
      },
    },
    defaultVariants: { size: { custom: { padding: '12px' } } },
    compoundVariants: [
      { when: { size: 'custom' }, style: { fontWeight: 600 } },
    ],
  })
}

styles.button({ size: { custom: { padding: '16px' } } })
```

Payload fields must be required scalars with explicit types. Defaults contain complete static payloads. Compounds match choice names. Conditional selections accept the same scoped payload objects, with separate variable names for each condition. Only supplied selections and defaults bind values; switching choices returns fresh props without stale bindings.

Compilation validates callbacks and defaults without executing callbacks. Selection only serializes attributes and binds values to fixed slots. Payload values never create CSS rules, and callback validation never runs in application renders. Equal field names in different axes, choices, recipes, and conditions have distinct slots.
