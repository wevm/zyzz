# API

Public reference grouped by entrypoint, export, and method. Types and errors stay with their owning module; preview callouts mark contracts awaiting implementation.

| API                                         | Description                                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| [CLI][cli]                                  | Compile a source tree into rewritten modules, CSS, maps, and packed contracts.     |
| [zyzz](https://zyzz.sh/docs/api/core)       | Typed style definitions, themes, configuration, and callable authoring.            |
| [zyzz/babel][babel]                         | Compile literal web or native authoring before Babel language transforms.          |
| [zyzz/compiler](compiler/README.md)         | Extract style definitions and rewrite source with matching CSS and source maps.    |
| [zyzz/default][default]                     | Default config with appearance controls, a restoration script, and bundled tokens. |
| [zyzz/metro][metro]                         | Compile native style modules during Metro bundling.                                |
| [zyzz/next][next]                           | Connect source transformation, CSS delivery, and watching to Next.js.              |
| [zyzz/node](node/README.md)                 | Build and watch filesystem sources with explicit output ownership.                 |
| [zyzz/oxlint][oxlint]                       | Lint web styles, JSX applications, and project conventions.                        |
| [zyzz/react-native](react-native/README.md) | Compile shared definitions into native tables and select themes and schemes.       |
| [zyzz/runtime](runtime/README.md)           | Bind compiled class lists to styling overrides without generating CSS.             |
| [zyzz/unplugin][unplugin]                   | Compile web styles with Rollup, Webpack, esbuild, or the existing Vite adapter.    |
| [zyzz/vite][vite]                           | Connect source transformation and CSS delivery to Vite.                            |
| [zyzz/web][web]                             | Compile web CSS and declare global rules, cascade layers, and at-rules.            |

[babel]: https://zyzz.sh/docs/api/babel
[cli]: https://zyzz.sh/docs/api/cli
[default]: https://zyzz.sh/docs/guides/default-theme
[metro]: https://zyzz.sh/docs/api/metro
[next]: https://zyzz.sh/docs/api/next
[oxlint]: https://zyzz.sh/docs/api/oxlint
[unplugin]: https://zyzz.sh/docs/api/unplugin
[vite]: https://zyzz.sh/docs/api/vite
[web]: https://zyzz.sh/docs/api/web
