# Config Script

Return inline JavaScript that restores saved root theme and color-scheme preferences. The factory is pure and safe to call during server rendering; only the returned script accesses the browser.

```ts
import { script } from './zyzz.config.js'

const initialization = script()
```

## Signature

`zyzz.script(options = {}) => string`

The bound function derives the theme catalog, compiled scope classes, and default selection from its config. Named catalogs restore allowlisted theme names; single-theme and token-free configs restore only the color scheme. Server-rendered root props remain the fallback.

## Parameters

### options.storageKey

- Type: `string`
- Default: `'zyzz'`

localStorage key containing a JSON object. Supported fields are `theme` (a catalog key) and `colorScheme` (`'light'`, `'dark'`, or `'light dark'`). Either field may be omitted.

```ts
script({ storageKey: 'my-app-appearance' })
```

## Returns

A JavaScript source string for an inline, synchronous `<script>` early in `<head>`. It updates `document.documentElement`; never use `async`, `defer`, or `type="module"` for this initialization.

The script replaces only classes belonging to the config's catalog, preserving unrelated classes. It assigns only the `colorScheme` inline property. Server markup supplies the default theme and scheme; there is no duplicate default configuration in this helper.

Invalid fields preserve their respective defaults. Missing, malformed, non-object, or inaccessible storage leaves server markup intact. Matching uses own catalog keys, including for names such as `constructor`. It never writes storage, accesses cookies, registers listeners, or inserts CSS.

The generated source safely serializes all values for embedding in HTML, including `</script>`, quotes, and Unicode separators. It does not evaluate saved strings as code.

## CSP and Hydration

Attach an application's CSP nonce to the script element, or authorize the exact generated source through a CSP hash. No inline event handlers or `eval` are required.

React root markup can use `suppressHydrationWarning` for attributes changed before hydration. Client preference controls initialize from the applied root state. The helper does not manage hydration or live application state.

See [Restore Preferences](../../../guides/themes.md#restore-preferences) for complete markup and the localStorage record.
