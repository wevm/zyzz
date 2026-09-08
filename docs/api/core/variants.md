# variants

> [!NOTE]
> Preview API; not yet implemented.

Define finite style choices for one element.

```ts
import { variants } from 'zyzz'

const button = variants({
  defaultVariants: { size: 'sm' },
  variants: { size: { md: { padding: '1rem' }, sm: { padding: '0.5rem' } } },
})
const props = button({ size: 'md' })
```

## Signature

`variants(definition)`

## Parameters

- `base`: common declarations.
- `compoundVariants`: ordered `{ style, when }` rules matching choice names.
- `defaultVariants`: selections for omitted axes.
- `variants`: axes and named choices; dynamic choices use typed callbacks.

## Returns

One callable returning one props object. Infer selections with `NonNullable<Parameters<typeof button>[0]>`. Null suppresses an axis and its default; false remains an explicit choice.

## Errors

Reject unknown axes, choices, payloads, and styling overrides. No slots map is accepted.

Config and theme handles expose bound `variants`. Compound arrays match any listed choice. See [Define Variants](../../guides/variants.md).
