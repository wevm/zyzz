# Metro

`zyzz/metro` compiles literal shared authoring during iOS and Android bundling. The adapter preserves the configured Babel transformer, including Expo's preset, plugins, and platform handling. Application code imports its style modules directly.

```ts
import { getDefaultConfig } from 'expo/metro-config'
import { zyzz } from 'zyzz/metro'

export default zyzz(getDefaultConfig(import.meta.dirname), {
  colorScheme: 'light',
  units: { px: 1 },
})
```

## API

| Export | Purpose |
| --- | --- |
| `zyzz(config, options)` | Return a Metro configuration with native compilation before the existing Babel transformer. |
| `Config` | Minimum structural configuration accepted by the adapter. Other caller fields are preserved. |

`config.transformer.babelTransformerPath` must identify an existing transformer. `projectRoot` defaults to the working directory. Setup writes a content-addressed adapter entrypoint into `.zyzz/metro`. Filesystem errors propagate. No application style files are generated.

`options.colorScheme` must be `light` or `dark`. `options.units` supplies native length conversion factors. Platform comes from each Metro transform request. Scheme and units are fixed for a server lifecycle. Restart Metro after changing configuration.

The transformer cache includes options, library implementation files, and the upstream cache key. Ordinary source imports remain Metro dependencies. Changes to an imported style module transform that module again. No separate watcher or manual generation command is required.

## Supported authoring

Literal `style`, `variants`, scalar callbacks, native target overrides, and local composition use the existing native compiler. Exported definitions can be imported and applied from other application modules. Namespace-style organization remains supported. Compilation does not execute authoring callbacks.

Theme/config helpers, graph-evaluated imports, packed contracts, and cross-module composition requiring compile-time evaluation are outside this adapter. `Config`, root namespace imports, and bundled-theme imports produce diagnostics. Import definitions directly from their source modules instead of forwarding authoring helpers. Transitive helper forwarding is unsupported.

Only iOS and Android transforms receive the plugin. Web and dependency files under `node_modules` pass through to the configured transformer. Web CSS delivery and packaged native authoring need separate adapters. Native type checking still sees shared authoring return types before Babel compilation.

See the [Expo app](../../../examples/expo-native/README.md) for an executable consumer. Bundle success does not establish native renderer conformance.
