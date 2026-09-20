# Selection

Select compiler-owned theme classes and optional color-scheme props. A selected scheme adds its compiled stylesheet class and an inline `color-scheme`. Generated modules use this runtime helper without evaluating authoring code or generating CSS.

## create

`Selection.create(entries, html?)` returns a scope selector.

```ts
import { Selection } from 'zyzz/runtime'

const vars = Selection.create([
  ['base', 'z-base'],
  ['mint', 'z-mint'],
])
const props = vars({ set: 'mint', colorScheme: 'dark' })
```

### entries

Type: `readonly (readonly [string, string])[]`. Required compatible theme names paired with compiler-assigned scope classes. Names infer the selector's accepted `set` values.

```ts
Selection.create([['base', 'z-base']])
```

### html

Type: `boolean`. Optional; defaults to `false`. Selects HTML attributes with serialized CSS when true, or React props otherwise.

```ts
const vars = Selection.create([['base', 'z-base']], true)
vars({ set: 'base', colorScheme: 'light dark' })
```

## Returned Selector

The callable accepts `{ set, colorScheme? }`. Unknown theme names, option keys, and schemes throw `TypeError`.

### set

Type: an inferred catalog key. Required; selects one compiled scope.

```ts
vars({ set: 'base' })
```

### colorScheme

Type: `'light' | 'dark' | 'light dark' | undefined`. Optional; omission adds no inline scheme declaration, preserving inheritance.

```ts
vars({ set: 'mint', colorScheme: 'dark' })
```

### className

Type: `string`. Present on React output; contains the compiled scope class, followed by the scheme class when a scheme is selected.

```ts
vars({ set: 'mint' }).className
```

### class

Type: `string`. Replaces `className` on HTML selector output.

```ts
Selection.create([['base', 'z-base']], true)({ set: 'base' }).class
```

### style

Type: `{ readonly colorScheme: 'light' | 'dark' | 'light dark' }` for React output, or `string` for HTML output. Omitted when no scheme is selected. The scheme class in `className` carries the same `color-scheme` in the stylesheet, which lowered `light-dark()` helpers require. HTML attribute escaping belongs to the renderer.

```ts
vars({ set: 'base', colorScheme: 'dark' }).style
// { colorScheme: 'dark' }
```
