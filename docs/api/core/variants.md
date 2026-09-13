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

Each recipe owns its emitted `data-*` attributes. Multipart components use separate definitions and shared component inputs. Recipes have no slots. Ordinary JSX spreads replace props; they are not a composition API.

> [!NOTE]
> Theme/config-bound recipes, responsive selections, dynamic choice payloads, and explicit composition follow in the Phase 3 stack. This initial slice supports root recipes with static choices.

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
