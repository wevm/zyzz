# zyzz/react-native

Create typed native authoring with React subscriptions and compile shared definitions into native style objects. This entrypoint requires React 19. The native Provider subscribes to window dimensions for responsive styles. Applications select the color scheme and variable set.

> [!NOTE]
> Static tables, variants, dynamic scalar bindings, graph/CLI integration, and explicit host lifecycle are supported within their documented limits. iOS/Android rendering acceptance remains pending.

| API                                   | Description                                                     |
| ------------------------------------- | --------------------------------------------------------------- |
| [defineConfig](react.md#defineconfig) | Existing authoring helpers and a configuration-typed Provider.  |
| [Host](Host.md)                       | Explicit context updates, bound callables, and adapter cleanup. |
| [StyleSheet](StyleSheet/README.md)    | Native table compilation, capabilities, and selection.          |
| [useStyles](react.md#usestyles)       | Explicit resolution of Provider-selected native styles.         |
| [useVars](react.md#usevars)           | Readonly native variables with an optional selector.            |
| [Variants](Variants.md)               | Bounded native recipe tables with finite choice metadata.       |

Static recipes from `Source.extract` retain ordered alternatives for [`Variants.compile`](Variants.md).

See the planned [universal styling contract](universal.md) and the version-pinned native conformance inventory.

[Native.compile](../compiler/Native.md) emits callable native modules from local shared authoring.

See [React integration](react.md) for configuration-returned `Provider`, `useStyles`, and `useVars` usage.
