# Babel

The default export from `zyzz/babel` compiles literal Zyzz authoring before Babel lowers TypeScript and JSX. It requires Babel 7 and preserves authored source locations. The original TypeScript/JSX preset remains responsible for language lowering.

```ts
import { transformSync } from '@babel/core'
import zyzz from 'zyzz/babel'

const result = transformSync(source, {
  filename: 'Styles.ts',
  plugins: [[zyzz, {
    colorScheme: 'light',
    platform: 'ios',
    units: { px: 1 },
  }]],
  presets: ['babel-preset-expo'],
})
```

| Option | Contract |
| --- | --- |
| `colorScheme` | Required `light` or `dark`, selected at build time. |
| `platform` | Required `ios` or `android`. |
| `units` | Optional native length conversion factors. Unsupported or unmapped values retain native compiler diagnostics. |

A filename is required for authoring modules. Ordinary modules pass through. Unsupported native styles fail during compilation. Theme/config imports and authoring-helper re-exports are rejected because they require graph evaluation.

Use [`zyzz/metro`](../metro/README.md) with Expo so platform selection, transformer chaining, and cache keys are configured together. Do not also register this plugin manually in that application.
