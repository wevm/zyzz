# Documentation

Zyzz compiles typed styles to static CSS and small application props.

1. [Getting Started](guides/getting-started.md): a first component with Vite or CLI setup.
2. [Guides](guides/README.md): everyday styling, themes, variants, and shared CSS.
3. [Concepts](concepts.md): theme scopes, conditions, relationships, and compilation.
4. [API Reference](api.md): entrypoints and public contracts.
5. [Literal Style Definitions](literal-styles.md): supported values, validation, and CSS emission.
6. [In-Memory Themes](themes.md): token compilation and scope selection through compiler APIs.

Literal styles, scalar themes, source transforms, and the file host are implemented at the documented boundaries. Bound `theme.css` has types and token resolution; source linking remains separate at this baseline (`9aa72fc`).

> [!NOTE]
> These APIs are previews and are not yet implemented:
>
> - CLI, build plugins, bundled themes, and React Native output.
> - Conditions, typed relatives, layers, globals, fonts, and keyframes.
> - `Config.create`, theme variable expressions, and broad CSS values.
> - `variants`, dynamic callbacks, `cx`, and shared `Vars`.

The [capability inventory](../.agents/parity.md) tracks detailed gaps. The [architecture](../.agents/architecture.md) defines compiler contracts and the [plan](../.agents/plan.md) tracks implementation gates.
