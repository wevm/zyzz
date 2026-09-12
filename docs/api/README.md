# API

Public reference grouped by entrypoint, export, and method. Types and errors stay with their owning module; preview callouts mark contracts awaiting implementation.

| API                                         | Description                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| [CLI](cli.md)                               | Compile a source tree into rewritten modules, declarations, and CSS.            |
| [zyzz](core/README.md)                      | Typed style definitions, themes, configuration, and callable authoring.         |
| [zyzz/compiler](compiler/README.md)         | Extract style definitions and rewrite source with matching CSS and source maps. |
| [zyzz/next](next/README.md)                 | Connect source transformation, CSS delivery, and watching to Next.js.           |
| [zyzz/node](node/README.md)                 | Build and watch filesystem sources with explicit output ownership.              |
| [zyzz/react-native](react-native/README.md) | Compile shared definitions into native tables and select themes and schemes.    |
| [zyzz/runtime](runtime/README.md)           | Bind compiled class lists to styling overrides without generating CSS.          |
| [zyzz/themes/default](themes/default.md)    | Preview: opt-in bundled design tokens. Core `zyzz` imports remain token-free.   |
| [zyzz/vite](vite/README.md)                 | Connect source transformation and CSS delivery to Vite.                         |
| [zyzz/web](web/README.md)                   | Compile web CSS and declare stylesheet contributions and element relationships. |
