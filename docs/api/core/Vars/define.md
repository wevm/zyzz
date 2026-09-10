# Vars.define

Create a shared contract for explicit CSS variable bindings.

```ts
import { Vars } from 'zyzz'

const progress = Vars.define({ amount: 'percentage' })
```

## Signature

`Vars.define(schema)`

## Parameters

### schema

- Type: Record of `color | length | number | percentage` domains
- Required: Yes.

Named shared variable contract. Dynamic callbacks are a separate authoring feature.

```ts
Vars.define({ amount: 'percentage' })
```

## Returns

Returns typed references whose keys are inferred from the schema. The result is `Vars.Definition<schema>`.

### [name]

- Type: Typed CSS variable reference

A reference for each schema key, usable in properties with a compatible domain.

```ts
progress.amount
```

## Errors

Source extraction rejects nonliteral schemas, duplicate names, and unsupported scalar domains. Untransformed calls throw `css.MissingTransformError`.

Dynamic callbacks are a separate authoring feature. Shared contracts are for bindings spanning definitions.

See [Vars](README.md) for related methods and types.

Contracts currently require module-level constants and local style references. Runtime assignments may use exported compiled contracts. Imported references in style definitions, native bindings, and `@property` registration remain deferred.

`length` and `percentage` accept nonnegative dimensions, so they can be used in properties such as padding and width. Use `signedLength` or `signedPercentage` for values that may be negative; those slots are restricted to properties that accept negative dimensions. `number` accepts finite numbers and is restricted to properties that accept an unconstrained numeric domain.
