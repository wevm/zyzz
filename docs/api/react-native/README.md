# zyzz/react-native

Create typed native authoring and compile shared definitions into native style objects. This entrypoint requires React 19. Application state selects appearance and variables. Provider reads window dimensions automatically.

> [!NOTE]
> Custom native builds apply theme changes directly to supported native views. Expo Go retains React subscriptions. Renderer checks cover RN 0.86.3 and Expo 57. The full native conformance gate and wider version matrix remain open.

| API                                   | Description                                                      |
| ------------------------------------- | ---------------------------------------------------------------- |
| [defineConfig](react.md#defineconfig) | Existing authoring helpers and a configuration-typed Provider.   |
| [Host](Host.md)                       | Explicit context updates, bound callables, and adapter cleanup.  |
| [StyleSheet](StyleSheet/README.md)    | Native table compilation, capabilities, and selection.           |
| [useStyles](react.md#usestyles)       | Explicit resolution of Provider-selected native styles.          |
| [useVars](react.md#usevars)           | Readonly native variables with an optional selector.             |
| [Variants](Variants.md)               | Bounded native recipe tables with finite choice metadata.        |
| [withStyles](react.md#withstyles)     | Third-party style props with preserved component props and refs. |

Static recipes from `Source.extract` retain ordered alternatives for [`Variants.compile`](Variants.md).

See the planned [universal styling contract](universal.md) and the version-pinned native conformance inventory.

[Native.compile](../compiler/Native.md) emits callable native modules from local shared authoring.

See [React integration](react.md) for configuration-returned `Provider`, `useStyles`, and `useVars` usage.

The optional [Reanimated entrypoint](reanimated.md) publishes variables and applied numeric or color properties as shared values.

Ordinary `Image`, `Pressable`, `Text`, `TextInput`, and `View` imports receive compiler-managed bindings. Existing style props and refs remain on the native components. Static styles have no update subscription. Callback styles and other components retain React subscriptions.
