# variable

Declare one typed CSS variable, reference it in styles, and assign values per element.

```tsx
import { css, variable } from 'zyzz'

namespace variables {
  export const accent = variable('color')
}

namespace styles {
  export const label = css({
    variables: { [variables.accent]: 'tomato' },
    color: variables.accent,
    selectors: {
      '&:hover': { variables: { [variables.accent]: 'purple' } },
    },
  })
}

function Label() {
  return (
    <span style={styles.label({ style: variables.accent.set('blue') })}>
      Hello
    </span>
  )
}
```

## Signature

`variable(kind)` or `variable(kind, options)`

## Parameters

### kind

- Type: `color | length | number | percentage | signedLength | signedPercentage`
- Required: Yes.

The scalar domain constrains compatible CSS declarations and `.set(value)` assignments. `length` and `percentage` are nonnegative; signed domains permit negative dimensions. A `number` reference can only supply properties accepting unconstrained numeric values.

### options

- Type: `variable.Options<kind>`
- Default: Omitted; no registration is emitted.

Providing options emits CSS `@property` using the same generated variable name.

```ts
const gap = variable('length', {
  inherits: true,
  initialValue: '4px',
})
```

#### inherits

- Type: `boolean`
- Required with options: Yes.

Controls custom-property inheritance through the DOM. Unregistered custom properties follow ordinary CSS inheritance.

#### initialValue

- Type: Scalar value compatible with `kind`
- Required with options: Yes.

Must be computationally independent. Initial lengths use absolute units or zero; values depending on `currentColor`, other variables, or font-relative units are rejected by types.

#### syntax

- Type: CSS syntax matching `kind`
- Default: Inferred from `kind`.

Both signed and unsigned length domains emit `<length>`; percentage domains emit `<percentage>`.

## Returns

- Type: `variable.Reference<kind>`

An opaque reference usable as a declaration value, in template expressions, and as a computed key inside `variables`. Names are compiler-owned. Ordinary namespaces or objects can group independent references.

### set

`reference.set(value)` returns a frozen inline custom-property assignment object. The method can be detached. Assignments preserve the variable's domain through TypeScript and perform no runtime value validation or CSS generation.

```ts
const accent = variable('color')
const gap = variable('length')
const style = { ...accent.set('blue'), ...gap.set('12px') }
```

## Static Assignments

The `variables` property emits static custom-property declarations in authored order, including inside selectors and conditional rules. Values must be scalar strings or numbers. TypeScript widens computed object keys, so these assignments cannot enforce each key's individual domain. `.set(value)` retains domain checking.

## Source Requirements

Declare variables in module-level constants or namespaces before use. References preserve their identities through aliases, imports, re-exports, and packed libraries. Factories and registration options are compiled without evaluating application code. Native bindings remain unsupported.

This API replaces `variable()` and contract-level `.set(values)`. Recompile packed libraries using the new API; variable metadata uses contract version 14.

## Errors

Invalid source structure produces compiler diagnostics. Executing an untransformed declaration throws an error named `variable.MissingTransformError`.
