# Babel

The named `zyzz` export from `zyzz/babel` compiles literal authoring for web or native before Babel lowers TypeScript and JSX. It requires Babel 7 and preserves authored JavaScript locations. The application's presets remain responsible for language lowering.

## Web

```ts
import { transformSync } from '@babel/core'
import { zyzz } from 'zyzz/babel'

const result = transformSync(source, {
  filename: 'src/styles.ts',
  plugins: [[zyzz, { target: 'web', cssOutput: 'atomic' }]],
  presets: ['@babel/preset-typescript'],
})

const javascript = result?.code
const stylesheet = result?.metadata?.zyzz
// The consuming build emits stylesheet.css and its cssMap alongside javascript.
```

Web output includes rewritten JavaScript and `metadata.zyzz` with `css`, `cssMap`, and `moduleId`. The build must collect and load that CSS, preserve stylesheet order, and resolve relative asset URLs against their source module. Babel does not insert styles at runtime or write files.

Replace each module's previous stylesheet metadata after every transform. Absent metadata or empty CSS removes a previous stylesheet. The Babel JavaScript map and the CSS map are separate artifacts. Both retain original authoring locations.

`moduleId` defaults to the source filename relative to Babel's root, preserving directory names. Sources outside that root require an explicit portable `moduleId` or a shared root. IDs must be stable, unique, package-relative paths without traversal segments. `cssOutput` accepts `atomic` or `grouped` and defaults to `atomic`.

## Native

```ts
const result = transformSync(source, {
  filename: 'Styles.ts',
  plugins: [
    [
      zyzz,
      {
        target: 'native',
        platform: 'ios',
        units: { px: 1 },
      },
    ],
  ],
  presets: ['babel-preset-expo'],
})
```

Native output contains executable style tables and bindings, without CSS metadata. `platform` requires `ios` or `android`. `colorScheme` is omitted for runtime selection through the [React provider](../react-native/react.md). An explicit `light` or `dark` retains the standalone fixed-context compilation mode. `units` supplies optional length conversion factors. Omitting `target` preserves existing native configurations.

Use [`zyzz/metro`](../metro/README.md) with Expo for automatic platform selection, transformer chaining, and cache keys. Metro explicitly selects native compilation for iOS/Android. Web compilation through Babel does not add CSS delivery to the Metro adapter.

## Limits

A filename is required for authoring modules. Ordinary modules pass through. Unsupported target semantics fail during compilation. Web and fixed-context native compilation retain the literal, per-module boundary. Runtime native compilation accepts a closed `modules` graph and optional host-resolved `imports`; Metro supplies these automatically for local imported themes and helpers.

Public types include `Options`, its `WebOptions` and `NativeOptions` branches, and `WebMetadata`. Babel's metadata declaration is extended with optional `zyzz` stylesheet output.
