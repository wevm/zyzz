# Appearance

Apply, read, restore, and persist the root theme selection on `document.documentElement`.

```ts
import { Appearance } from 'zyzz/web'
import { themes } from './zyzz.config.js'

export const appearance = Appearance.create({
  defaults: { colorScheme: 'light dark', theme: 'base' },
  themes,
})
```

| API                 | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| [create](create.md) | Bind root appearance operations to a compiled theme catalog. |

The operations share the localStorage record that the config's [`script()`](../../core/Config/script.md) restores before first paint. A server-rendered document inlines that script in `<head>`; the [Vite plugin](../../vite/zyzz.md#initialization-script) inlines it into `index.html`. Client code then reads the applied root state with `current()` and persists changes with `select()`.

## Types

`Selection<name>` is `{ theme: name; colorScheme?: 'light' | 'dark' | 'light dark' }`. An omitted scheme inherits from CSS.

See [zyzz/web](../README.md) for the entrypoint overview.
