# Marker

Compiled relationship markers use `Marker` from `zyzz/runtime`. Applications normally author `Css.marker(schema)` from `zyzz/web`.

| API                  | Description                                                 |
| -------------------- | ----------------------------------------------------------- |
| `create(definition)` | Bind a callable to a compiler-assigned identity and schema. |
| `schema(input)`      | Copy and validate a finite state schema.                    |

## create

`Marker.create(definition)` returns a function accepting an optional state record. Calling the function returns a frozen string-valued attribute record. It performs no DOM lookup, registration, or CSS generation.

### definition.id

Type: `string`. The compiler supplies the private presence attribute name.

### definition.schema

Type: `Marker.Schema`, a readonly record of nonempty string/boolean tuples. Keys remain case-sensitive; emitted attribute fragments use lowercase names.

```ts
const marker = Marker.create({
  id: 'data-z-marker-card',
  schema: Marker.schema({ open: [true, false] }),
})
marker({ open: false })
```

## schema

`Marker.schema(input: unknown)` returns a frozen schema copy. It rejects invalid or case-colliding state names, accessors, duplicate serialized values, and empty domains. It does not read accessors.

## Errors

Schema errors and unknown or invalid application states throw `Error`. Omitted or undefined states emit no state attribute; `false` emits the string `'false'`. Replacing an element's applied props is the framework's responsibility.

`Marker.create` validates and copies its schema before creating the callable. Later mutations to the input record or state arrays do not change the accepted state domain. Identities must use the compiler-owned `data-z-` attribute form.
