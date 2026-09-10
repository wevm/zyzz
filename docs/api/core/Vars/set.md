# vars.set

Assign values through the contract returned by `Vars.define`.

```ts
import { Vars } from 'zyzz'

const vars = Vars.define({ amount: 'percentage' })
const style = vars.set({ amount: '42%' })
```

## Signature

`vars.set(values)`

## Parameters

### values

- Type: `Vars.Values<schema>` with inferred scalar domains and exact keys
- Required: Yes.

Partial assignments to this contract's named slots. Unknown keys and incompatible CSS values are rejected by TypeScript. The method is bound to its contract and can be passed independently of the object.

```ts
const set = vars.set
const style = set({ amount: '75%' })
```

## Returns

- Type: `Readonly<Record<\`--${string}\`, number | string>>`

A frozen inline custom-property assignment object, suitable for the `style` prop. Assignments do not create CSS rules or perform runtime value validation.

```ts
const style = vars.set({ amount: '42%' })
```

See [Vars](README.md) for the schema and reference types.
