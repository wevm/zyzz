# zyzz/react-native

Compile shared `Style.define` data into native style objects without importing React Native or reading device state.

> [!NOTE]
> Static table compilation and lookup support the documented subset. Native callable application, dynamic bindings, source/CLI native output, and iOS/Android rendering acceptance remain pending.

| API                                | Description                                            |
| ---------------------------------- | ------------------------------------------------------ |
| [StyleSheet](StyleSheet/README.md) | Native table compilation, capabilities, and selection. |

Static recipes from `Source.extract` retain ordered alternatives for [`Variants.compile`](Variants.md).

See the planned [universal styling contract](universal.md) and the version-pinned native conformance inventory.
