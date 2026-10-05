# API

Public reference grouped by entrypoint, export, and method. Types and errors stay with their owning module; preview callouts mark contracts awaiting implementation.

| API                                         | Description                                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| [CLI](cli.md)                               | Compile a source tree into rewritten modules, declarations, and CSS.               |
| [zyzz](https://zyzz.sh/docs/api/core)       | Typed style definitions, themes, configuration, and callable authoring.            |
| [zyzz/babel](babel/README.md)               | Compile literal web or native authoring before Babel language transforms.          |
| [zyzz/compiler](compiler/README.md)         | Extract style definitions and rewrite source with matching CSS and source maps.    |
| [zyzz/default][default]                     | Default config with appearance controls, a restoration script, and bundled tokens. |
| [zyzz/metro](metro/README.md)               | Compile native style modules during Metro bundling.                                |
| [zyzz/next](next/README.md)                 | Connect source transformation, CSS delivery, and watching to Next.js.              |
| [zyzz/node](node/README.md)                 | Build and watch filesystem sources with explicit output ownership.                 |
| [zyzz/oxlint][oxlint]                       | Lint web styles, JSX applications, and project conventions.                        |
| [zyzz/react-native][react-native-reference] | Configure native styles, select themes with React, and compile native tables.      |
| [zyzz/runtime](runtime/README.md)           | Bind compiled class lists to styling overrides without generating CSS.             |
| [zyzz/unplugin](unplugin/README.md)         | Compile web styles with Rollup, Webpack, esbuild, or the existing Vite adapter.    |
| [zyzz/vite](vite/README.md)                 | Connect source transformation and CSS delivery to Vite.                            |
| [zyzz/web][web]                             | Compile web CSS and declare global rules, cascade layers, and at-rules.            |

[default]: https://zyzz.sh/docs/guides/default-theme
[oxlint]: https://zyzz.sh/docs/api/oxlint
[react-native-reference]: https://zyzz.sh/docs/api/react-native
[web]: https://zyzz.sh/docs/api/web
