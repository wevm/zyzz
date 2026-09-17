# Metro

`zyzz/metro` compiles shared authoring during iOS and Android bundling. It preserves the application's Babel transformer, Expo preset, plugins, and platform handling. Application code imports style modules directly.

```ts
import { getDefaultConfig } from 'expo/metro-config'
import { zyzz } from 'zyzz/metro'

export default zyzz(getDefaultConfig(import.meta.dirname), {
  units: { px: 1 },
})
```

Metro supplies the platform. Zyzz compiles named themes and both schemes, including imported local configuration and authoring helpers. Connect the [React provider](../react-native/react.md) once above the application to follow system appearance or select an explicit theme and scheme. Selection changes do not restart Metro.

## Configuration

`zyzz(config, options)` returns the configuration with a chained transformer and development middleware. Options are optional; `units` specifies native length conversion factors. Unit mappings are build settings and require a Metro restart when changed.

`config.transformer.babelTransformerPath` must identify an existing transformer. `projectRoot` defaults to the working directory. Setup writes tooling glue into `.zyzz/metro`; it does not generate application style files. Filesystem and compilation errors propagate.

Local `.ts`, `.tsx`, `.js`, and `.jsx` source imports are linked without evaluating application code. Relative imports support native/platform suffixes and NodeNext `.js` references to TypeScript. Package imports and assets remain external. Authoring outside the project root, custom resolution aliases, bundled-theme imports, and packaged authoring contracts are not yet linked by this adapter.

## Updates and caching

Transform keys include imported source contents. Development middleware expands Metro's file-change notifications to affected consumers before delta calculation. This keeps imported token edits, style edits, recovery after errors, and platform-specific dependencies consistent with compiled output. Startup cache keys also include local source contents for offline exports.

The middleware preserves existing application middleware and uses Metro's bundler transform and watcher interfaces. The real Expo SDK 57 integration test exercises both platform bundles, imported theme changes, style changes, errors, and cache reuse. These Metro interfaces require verification when upgrading Metro or Expo.

## Boundaries

Native declarations retain the existing compiler diagnostics for unsupported CSS semantics. React JSX subscriptions and prop resolution are inserted by Babel; no custom JSX runtime or component wrapper is required. See the [React integration](../react-native/react.md) for supported component forms and explicit resolution outside JSX.

Only local iOS/Android source receives native compilation. Web and dependency files pass through to the upstream transformer. Web CSS delivery remains a separate integration. TypeScript still checks shared authoring types before Babel rewrites them to native props.

The [Expo app](../../../examples/expo-native/README.md) exercises system appearance, explicit overrides, named themes, variants, and dynamic inputs. Bundle success does not establish device renderer conformance.
