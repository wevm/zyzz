# Vars.define

Create a shared contract for explicit CSS variable bindings.

```ts
import { Vars } from 'zyzz'

const vars = Vars.define({ amount: 'percentage' })
```

## Signature

`Vars.define(schema)`

## Parameters

### schema

- Type: Record of `color | length | number | percentage | signedLength | signedPercentage` domains
- Required: Yes.

Named shared variable contract. Dynamic callbacks are a separate authoring feature.

```ts
Vars.define({ amount: 'percentage' })
```

## Returns

Returns typed references whose keys are inferred from the schema. The result is `Vars.Definition<schema>`.

### set

- Type: Generic method accepting `Vars.Values<schema>`

Returns inline assignments through `vars.set(values)`. The method is bound to its contract. The schema name `set` is reserved.

```ts
vars.set({ amount: '50%' })
```

### [name]

- Type: Typed CSS variable reference

A reference for each schema key, usable in properties with a compatible domain.

```ts
vars.amount
```

## Errors

Source extraction rejects nonliteral schemas, duplicate names, and unsupported scalar domains. Untransformed calls throw `Vars.MissingTransformError`.

Dynamic callbacks are a separate authoring feature. Shared contracts are for bindings spanning definitions.

See [Vars](README.md) for related methods and types.

Contracts require module-level constants. References and assignments retain their identities through imports, aliases, re-exports, and packed contracts. Native bindings remain deferred.

Registration descriptors emit CSS `@property` rules with the same fixed slot names:

```ts
const vars = Vars.define({
  amount: { type: 'percentage', inherits: false, initialValue: '0%' },
  gap: { type: 'length', inherits: true, initialValue: '4px' },
})
```

`inherits` and `initialValue` are required for descriptors. The optional `syntax` must match the scalar domain. Initial lengths use absolute units or zero; CSS resolves registered defaults and inheritance. Registration adds no runtime CSS generation.

`length` and `percentage` accept nonnegative dimensions, so they can be used in properties such as padding and width. Use `signedLength` or `signedPercentage` for values that may be negative; those slots are restricted to properties that accept negative dimensions. `number` accepts finite numbers and is restricted to properties that accept an unconstrained numeric domain.
