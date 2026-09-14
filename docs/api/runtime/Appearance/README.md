# Appearance

Compiler-generated initialization uses `Appearance` from `zyzz/runtime`. Applications normally export `script` from `Config.create`.

| API                      | Description                                        |
| ------------------------ | -------------------------------------------------- |
| `create(entries, opts?)` | Bind a script factory to compiled theme classes.   |
| `root(entries, opts?)`   | Bind live root controls to compiled theme classes. |

## create

`Appearance.create(entries)` returns `(options?: Config.ScriptOptions) => string`. Calling the factory has no DOM or storage side effects.

### entries

Type: `readonly (readonly [string, string])[]`. Each pair contains a catalog name and its compiled class. The compiler supplies these identities.

```ts
const script = Appearance.create([['mint', 'z_theme-mint']])
```

### options.storageKey

Type: `string`, default `'zyzz'`. Selects the localStorage entry read by the returned script.

```ts
script({ storageKey: 'appearance' })
```

## Returns

An HTML-safe JavaScript string for a synchronous script element before application rendering. On execution it restores recognized themes and color schemes on `document.documentElement`, preserving unrelated classes and styles. Invalid or inaccessible storage leaves server defaults intact. It writes no storage and installs no listeners.

## Errors

Serialization errors propagate to the caller. The returned script catches storage and restoration errors. CSP authorization belongs to the application.

## root

`Appearance.root(entries, options?)` returns `{ get, set }`. The compiler supplies it as the configuration's `appearance` member; `options.defaultTheme` is the catalog default reported without a root class and `options.storageKey` matches the script's key.

```ts
const appearance = Appearance.root([['mint', 'z_theme-mint']], {
  defaultTheme: 'mint',
})

appearance.set({ colorScheme: 'dark' })
appearance.get() // { theme: 'mint', colorScheme: 'dark' }
```

`get()` reads the theme and scheme classes on `document.documentElement`. `set()` merges fields over that reading, replaces the catalog and scheme classes plus the inline `color-scheme`, and writes the record; blocked storage keeps the change for the current document. Unknown themes or schemes throw `TypeError`.
