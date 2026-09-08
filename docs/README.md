# Documentation

Zyzz compiles typed styles to static CSS and small application props.

- [Concepts](concepts.md): configuration, theme contracts, scopes, conditions, layers, and compilation.
- [Usage](usage.md): current compilation flows and previews of configuration, styling, recipes, and stylesheet authoring.
- [API Reference](api.md): entrypoints, public contracts, diagnostics, and implementation status.
- [Literal Style Definitions](literal-styles.md): the implemented property grammar, validation, ordering, and pure CSS compilation.
- [In-Memory Themes](themes.md): the implemented token groups, compatible overrides, and theme scope selection.

Literal styles, scalar themes, source transforms, and the file host are implemented at the documented boundaries. Bound `theme.css` has types and token resolution; source linking remains separate at this baseline (`9aa72fc`).

> [!NOTE]
> These APIs are previews and are not yet implemented:
>
> - CLI, build plugins, bundled themes, and React Native output.
> - Conditions, typed relatives, layers, globals, fonts, and keyframes.
> - `Config.create`, theme variable expressions, and broad CSS values.
> - `variants`, dynamic callbacks, `cx`, and shared `Vars`.

The [capability inventory](../.agents/parity.md) tracks detailed gaps. The [architecture](../.agents/architecture.md) defines compiler contracts and the [plan](../.agents/plan.md) tracks implementation gates.
