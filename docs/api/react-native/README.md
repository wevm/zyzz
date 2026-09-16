# zyzz/react-native

Compile shared `Style.define` data into native style objects without importing React Native or reading device state.

> [!NOTE]
> Static table compilation and lookup support the documented subset. Static variants and local native callable compilation are supported. Dynamic bindings, native graph/CLI integration, and iOS/Android rendering acceptance remain pending.

| API                                | Description                                               |
| ---------------------------------- | --------------------------------------------------------- |
| [StyleSheet](StyleSheet/README.md) | Native table compilation, capabilities, and selection.    |
| [Variants](Variants.md)            | Bounded native recipe tables with finite choice metadata. |

Static recipes from `Source.extract` retain ordered alternatives for [`Variants.compile`](Variants.md).

See the planned [universal styling contract](universal.md) and the version-pinned native conformance inventory.

[Native.compile](../compiler/Native.md) emits callable native modules from local shared authoring.
