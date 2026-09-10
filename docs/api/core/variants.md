# variants

> [!NOTE]
> Preview API; not yet implemented.

Define finite style choices for one element.

```ts
import { variants } from 'zyzz'

const styles = {
  button: variants({
    defaultVariants: { size: 'sm' },
    variants: { size: { md: { padding: '1rem' }, sm: { padding: '0.5rem' } } },
  }),
}
const props = styles.button({ size: 'md' })
```

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

Applying the returned callable produces one props object, including generated recipe attributes when required. `className` and `style` describe that object; the exact preview type names remain to be finalized.

### Callable

- Type: Callable returning styling props

Returns props for one element. Infer selections with `NonNullable<Parameters<typeof button>[0]>`.

```ts
const props = styles.button({ size: 'md' })
```

### className

- Type: `string`

Generated class list, including supplied external classes. Class-string order does not establish CSS precedence.

```ts
props.className
```

### style

- Type: Inline style bindings and overrides

Copied inline overrides when supplied. Other component props remain on the element.

```ts
props.style
```

## Errors

Reject unknown axes, choices, payloads, and styling overrides. No slots map is accepted.

Config and theme handles expose bound `variants`. Compound arrays match any listed choice. See [Define Variants](../../guides/variants.md#define-variants).
