# Metro

`zyzz/metro` compiles shared authoring during iOS and Android bundling. It preserves the application's Babel transformer, Expo preset, plugins, and platform handling. Application code imports style modules directly.

```ts
import { getDefaultConfig } from 'expo/metro-config'
import { zyzz } from 'zyzz/metro'

export default zyzz(getDefaultConfig(import.meta.dirname), {
  fonts: { 'Pilat, Arial, sans-serif': 'Pilat' },
  units: { px: 1, rem: 16 },
})
```

Metro supplies the platform. Zyzz compiles named themes and both schemes, including imported local configuration and authoring helpers. Connect the [React provider](../react-native/react.md) once above the application to follow system appearance or select an explicit theme and scheme. Selection changes do not restart Metro.

## Configuration

`zyzz(config, options)` chains the transformer, resolver, and development middleware. Options are optional. `units` specifies positive finite native length scales, with `px` defaulting to `1`. Supply `rem` when used. `fonts` maps exact authored family strings to registered native names. Changing either mapping requires a Metro restart.

Register or load the application's font assets before rendering. A mapping does not load a font or validate its availability, weight, or style on a device.

`config.transformer.babelTransformerPath` must identify an existing transformer. `projectRoot` defaults to the working directory. Setup writes tooling glue into `.zyzz/metro`; it does not generate application style files. Filesystem and compilation errors propagate.

Source graphs use Metro's resolver, including package exports, subpaths, application aliases, platform suffixes, and linked packages outside `projectRoot`. Preserve the application's `watchFolders` and resolver settings so those files are visible to Metro. Missing relative `.js` imports retry TypeScript source resolution for NodeNext packages. Existing JavaScript resolutions retain precedence.

Shared packages can publish source authoring or source-free JavaScript with adjacent `.zyzz.json` contracts. The adapter discovers Zyzz imports and authoring re-exports, then supplies their source or contracts to the compiler. Application modules are never evaluated during compilation. Assets and ordinary dependencies retain Metro's handling.

Source packages must declare their Zyzz dependency to discover authoring behind barrels and indirect helper imports. Direct entry imports and packed contracts are detected independently. This declaration bounds discovery so unrelated package graphs stay outside native compilation.

## Updates and caching

Transform keys include the resolved source graph and packed contracts. The adapter expands Metro's file-change notifications to affected consumers before delta calculation. Imported token edits, style edits, package metadata, and platform-specific dependencies invalidate their consumers. Expo offline exports receive the same source graph through its middleware setup.

Existing application middleware and custom resolution run through the adapter. The Expo SDK 57 integration test exercises both platform bundles, DS token edits, packed contracts, errors, cache reuse, and offline exports. Metro's bundler, resolver, and watcher interfaces require verification when upgrading Metro or Expo.

## Boundaries

Native declarations retain the existing compiler diagnostics for unsupported CSS semantics. React JSX subscriptions and prop resolution are inserted by Babel; no custom JSX runtime or component wrapper is required. See the [React integration](../react-native/react.md) for supported component forms and explicit resolution outside JSX.

iOS/Android application and shared authoring receive native compilation. Web and ordinary dependencies pass through to the upstream transformer. Web CSS delivery remains a separate integration. TypeScript still checks shared authoring types before Babel rewrites them to native props.

Direct transformer calls without Metro's middleware retain relative source linking. Package linking requires the server setup used by Expo development and export commands. `zyzz/default` contains web contributions and remains unsupported by the native adapter.

The [Expo app](../../../examples/react-native/README.md) exercises system appearance, explicit overrides, named themes, variants, and dynamic inputs. Bundle success does not establish device renderer conformance.
