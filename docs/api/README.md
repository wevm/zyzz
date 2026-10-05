# API

Public reference grouped by entrypoint, export, and method. Types and errors stay with their owning module; preview callouts mark contracts awaiting implementation.

| API                                                | Description                                                                        |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [CLI](https://zyzz.sh/docs/api/cli)                | Compile a source tree into rewritten modules, CSS, maps, and packed contracts.     |
| [zyzz](https://zyzz.sh/docs/api/core)              | Typed style definitions, themes, configuration, and callable authoring.            |
| [zyzz/babel](https://zyzz.sh/docs/api/babel)       | Compile literal web or native authoring before Babel language transforms.          |
| [zyzz/compiler](compiler/README.md)                | Extract style definitions and rewrite source with matching CSS and source maps.    |
| [zyzz/default](default.md)                         | Default config with appearance controls, a restoration script, and bundled tokens. |
| [zyzz/metro](https://zyzz.sh/docs/api/metro)       | Compile native style modules during Metro bundling.                                |
| [zyzz/next](https://zyzz.sh/docs/api/next)         | Connect source transformation, CSS delivery, and watching to Next.js.              |
| [zyzz/node](node/README.md)                        | Build and watch filesystem sources with explicit output ownership.                 |
| [zyzz/oxlint](oxlint/README.md)                    | Lint web styles, JSX applications, and project conventions.                        |
| [zyzz/react-native](react-native/README.md)        | Compile shared definitions into native tables and select themes and schemes.       |
| [zyzz/runtime](runtime/README.md)                  | Bind compiled class lists to styling overrides without generating CSS.             |
| [zyzz/unplugin](https://zyzz.sh/docs/api/unplugin) | Compile web styles with Rollup, Webpack, esbuild, or the existing Vite adapter.    |
| [zyzz/vite](https://zyzz.sh/docs/api/vite)         | Connect source transformation and CSS delivery to Vite.                            |
| [zyzz/web](web/README.md)                          | Compile web CSS and declare stylesheet contributions and element relationships.    |
