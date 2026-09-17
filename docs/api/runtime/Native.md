# Native runtime

`Native` from `zyzz/runtime` applies compiler-owned native tables without importing parsers, React Native, or device APIs.

- `create({ axes, defaults, styles })` returns a callable selecting one finite native style. Supply a theme/scheme table from `StyleSheet.select(compiled.styles, context)`. Omitted and undefined inputs use defaults; null suppresses them. The callable accepts a native `style` override after the selected object.
- `compose(...props)` returns native style props in argument order. Falsy entries are ignored. A single entry preserves its style reference. Nested arrays and structured override values remain caller-owned.
- `Callable<Axes>` and `Props` describe generated native inputs and outputs. Undeclared axes, choices, missing table entries, and web props raise `Native.SelectionError`.

`create` freezes compiler-owned style objects at initialization. Application only selects existing data and allocates props or composition arrays. It does not mutate or freeze override values.
