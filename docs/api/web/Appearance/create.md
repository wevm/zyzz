# Appearance.create

Bind root appearance operations to a compiled named theme catalog.

```ts
import { Appearance } from 'zyzz/web'
import { themes } from './zyzz.config.js'

const appearance = Appearance.create({
  defaults: { colorScheme: 'light dark', theme: 'base' },
  themes,
})

appearance.restore()
appearance.select({ colorScheme: 'dark', theme: 'mint' })
```

## Signature

`Appearance.create(options)`

Creation reads no browser state. Each returned operation reads or writes `document.documentElement` and localStorage when called, so the instance can be created in shared modules and used after mount.

## Parameters

### options.defaults

- Type: `Selection<name>`
- Required: Yes.

Selection applied by `restore()` when storage holds no valid record, and the theme `current()` reports when the root carries no catalog class.

```ts
defaults: { colorScheme: 'light dark', theme: 'base' }
```

### options.storageKey

- Type: `string`
- Default: `'zyzz'`

localStorage key shared with the config's `script({ storageKey })`.

```ts
storageKey: 'my-app-appearance'
```

### options.themes

- Type: `{ readonly [name]: { readonly className: string } }`
- Required: Yes.

The named catalog from `Config.create`. Its members supply the compiled scope classes; the catalog keys infer the accepted theme names.

```ts
themes
```

## Returns

### apply

- Type: `(selection: Selection<name>) => void`

Replaces the root's catalog and scheme classes with the selection and sets or clears the inline `color-scheme`. Nothing is saved.

```ts
appearance.apply({ theme: 'mint' })
```

### current

- Type: `() => Selection<name>`

Reads the selection the root carries. Controls initialize from this value after the initialization script has run.

```ts
const { colorScheme, theme } = appearance.current()
```

### restore

- Type: `() => Selection<name>`

Applies the saved record over the defaults, field by field, and returns the result. Unknown themes, invalid schemes, malformed data, and blocked storage fall back to the defaults. Client-rendered documents call this before mounting when no head script is present.

```ts
const initial = appearance.restore()
```

### select

- Type: `(selection: Selection<name>) => void`

Applies the selection and saves it under the storage key. Blocked storage keeps the selection for the current document only.

```ts
appearance.select({ colorScheme: 'dark', theme: 'mint' })
```

## Errors

None. Storage access failures are contained.

See [Appearance](README.md) for related types.
