# Vars.set

Assign values to an explicit shared variable contract.

```ts
import { Vars } from 'zyzz'

const progress = Vars.define({ amount: 'percentage' })
const style = Vars.set(progress, { amount: '42%' })
```

## Signature

`Vars.set(definition, values)`

## Parameters

### definition

- Type: Shared contract returned by `Vars.define`
- Required: Yes.

Defines allowed assignment keys and domains.

```ts
Vars.set(progress, { amount: '42%' })
```

### values

- Type: Assignments to inferred contract keys
- Required: Yes.

Existing keys with compatible values. Compiler-owned private variables are not application override keys.

```ts
Vars.set(progress, { amount: '42%' })
```

## Returns

### style

- Type: Inline variable assignment object

Returned object can be supplied as the applied style override.

```ts
const style = Vars.set(progress, { amount: '42%' })
```

## Errors

Reject unknown keys, accessors, symbols, and incompatible scalar primitives; numeric slots require finite numbers. CSS grammar, units, and sign compatibility are checked by the TypeScript authoring contract, not reparsed at runtime. Untyped inputs must be validated at the application boundary before calling `Vars.set`. Private compiler-owned variables are not application override keys.

See [Vars](README.md) for related methods and types.

Contracts currently require module-level constants and local style references. Runtime assignments may use exported compiled contracts. Imported references in style definitions, native bindings, and `@property` registration remain deferred.
