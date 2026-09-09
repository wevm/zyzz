# variants

Define finite style choices for one element.

```ts
import { variants } from 'zyzz'

const button = variants({
  defaultVariants: { size: 'sm' },
  variants: { size: { md: { padding: '1rem' }, sm: { padding: '0.5rem' } } },
})
const selected = button({ size: 'md' })
```

Preview API; not yet implemented.

## Signature

`variants(definition)`

## Parameters

### definition.base

- Type: Style declarations
- Default: No base declarations.

Common declarations for every application.

```ts
variants({ base: { display: 'inline-flex' }, variants: {} })
```

### definition.compoundVariants

- Type: Ordered `{ style, when }` rules
- Default: No compound rules.

Match choice names, including arrays of alternatives, and combine matching styles in authored order.

```ts
variants({
  compoundVariants: [{ style: { opacity: 0.8 }, when: { size: 'md' } }],
  variants: { size: { md: { padding: '1rem' } } },
})
```

### definition.defaultVariants

- Type: Selections keyed by inferred axes
- Default: No default selections.

Selections for omitted axes. Null suppresses a choice and its default; false remains an explicit choice.

```ts
variants({
  defaultVariants: { size: 'sm' },
  variants: { size: { sm: { padding: '0.5rem' } } },
})
```

### definition.variants

- Type: Axes and named style choices
- Required: Yes.

Finite choices compile ahead of time. Dynamic choices use typed callbacks.

```ts
variants({ variants: { size: { md: { padding: '1rem' } } } })
```

## Returns

A callable that accepts inferred selections and returns one opaque style value for the `style` prop. The compiler carries generated classes, recipe attributes, and dynamic bindings to the intrinsic element. Exact preview type names remain to be finalized.

```tsx
const example = <button style={button({ size: 'md' })} />
```

Infer selections with `NonNullable<Parameters<typeof button>[0]>`. Keep external classes and unrelated component props on the element.

## Errors

Reject unknown axes, choices, payloads, and styling overrides. No slots map is accepted.

Config and theme handles expose bound `variants`. Compound arrays match any listed choice. See [Define Variants](../../guides/variants.md#define-variants).
