# Documentation

Zyzz compiles typed style definitions to static CSS and small application props. Start with the concepts, follow the usage guide, and use the API reference for signatures and availability.

- [Concepts](concepts.md): configuration, theme contracts, scopes, conditions, layers, and compilation.
- [Usage](usage.md): current compilation flows and previews of configuration, styling, recipes, and stylesheet authoring.
- [API Reference](api.md): entrypoints, public contracts, diagnostics, and implementation status.
- [Literal Style Definitions](literal-styles.md): the implemented property grammar, validation, ordering, and pure CSS compilation.
- [In-Memory Themes](themes.md): the implemented token groups, compatible overrides, and theme scope selection.

## Availability

The implemented contracts below describe this branch's baseline, main `9aa72fc`. API previews document accepted designs and are not exports that can already be called.

| Area                                                                | Availability                                                            |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Literal root `css`, source extraction/rewriting, and file host      | Implemented; authoring calls require transformation                     |
| `Style.define`, `Theme.define`/`extend`, and `Css.compile`          | Implemented for the documented literal/scalar subset                    |
| Bound `theme.css`                                                   | Types and token resolution implemented; source linking remains separate |
| `Config.create`, theme variables in expressions, broad CSS values   | Preview                                                                 |
| Conditions, typed relatives, layers, globals, fonts, and keyframes  | Preview                                                                 |
| `variants`, dynamic callbacks, `cx`, and shared `Vars`              | Preview                                                                 |
| CLI, bundled default themes, build plugins, and React Native output | Preview                                                                 |

The [capability inventory](../.agents/parity.md) tracks detailed gaps. The [architecture](../.agents/architecture.md) defines compiler contracts and the [plan](../.agents/plan.md) tracks implementation gates.
