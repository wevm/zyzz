# zyzz/react-native

Compile shared `Style.define` data into native style objects without importing React Native or reading device state.

> [!NOTE]
> Static tables, variants, dynamic scalar bindings, graph/CLI integration, and explicit host lifecycle are supported within their documented limits. iOS/Android rendering acceptance remains pending.

| API                                | Description                                                     |
| ---------------------------------- | --------------------------------------------------------------- |
| [Host](Host.md)                    | Explicit context updates, bound callables, and adapter cleanup. |
| [StyleSheet](StyleSheet/README.md) | Native table compilation, capabilities, and selection.          |
| [Variants](Variants.md)            | Bounded native recipe tables with finite choice metadata.       |

Static recipes from `Source.extract` retain ordered alternatives for [`Variants.compile`](Variants.md).

See the planned [universal styling contract](universal.md) and the version-pinned native conformance inventory.

[Native.compile](../compiler/Native.md) emits callable native modules from local shared authoring.
