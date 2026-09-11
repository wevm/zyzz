# Selection

Select compiler-owned theme classes and optional color-scheme props. Generated modules use this runtime helper without evaluating authoring code or generating CSS.

## create

`Selection.create(entries, html?)` returns a selector and named catalog members.

```ts
import { Selection } from 'zyzz/runtime'

const themes = Selection.create([
  ['base', 'z-base'],
  ['mint', 'z-mint'],
])
const props = themes({ theme: 'mint', colorScheme: 'dark' })
```

### entries

Type: `readonly (readonly [string, string])[]`. Required compatible theme names paired with compiler-assigned scope classes. Names infer the selector's accepted `theme` values.

```ts
Selection.create([['base', 'z-base']])
```

### html

Type: `boolean`. Optional; defaults to `false`. Selects HTML attributes with serialized CSS when true, or React props otherwise.

```ts
const themes = Selection.create([['base', 'z-base']], true)
themes({ theme: 'base', colorScheme: 'light dark' })
```

## Returned Selector

The callable accepts `{ theme, colorScheme? }`. Unknown theme names, option keys, and schemes throw `TypeError`.

### theme

Type: an inferred catalog key. Required; selects one compiled scope.

```ts
themes({ theme: 'base' })
```

### colorScheme

Type: `'light' | 'dark' | 'light dark' | undefined`. Optional; omission adds no inline scheme declaration, preserving inheritance.

```ts
themes({ theme: 'mint', colorScheme: 'dark' })
```

### className

Type: `string`. Present on React output and every named catalog member; contains the compiled scope class.

```ts
themes({ theme: 'mint' }).className
themes.mint.className
```

### class

Type: `string`. Replaces `className` on HTML selector output.

```ts
Selection.create([['base', 'z-base']], true)({ theme: 'base' }).class
```

### style

Type: `{ readonly colorScheme: 'light' | 'dark' | 'light dark' }` for React output, or `string` for HTML output. Omitted when no scheme is selected. HTML attribute escaping belongs to the renderer.

```ts
themes({ theme: 'base', colorScheme: 'dark' }).style
// { colorScheme: 'dark' }
```
