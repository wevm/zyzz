# Native dynamic runtime

`NativeDynamic` from `zyzz/runtime` applies compiler-generated scalar bindings without executing authoring callbacks or importing compiler and device APIs. Generate its metadata through `Native.compile` or a native `Graph.compile` build.

`create(options)` accepts finite recipe choices, defaults, optional payload metadata, a binding `program`, selected static `styles`, and explicit font/unit mappings. Its callable consumes scalar fields and scoped variant selections, applies matching rules in authored order, and places caller-owned `style` overrides last. Null selections suppress defaults.

Compiler-owned static fragments are frozen once. Dynamic results are fresh objects. Override objects retain identity and are never frozen. Missing fields, unknown selections, invalid numeric/length/color values, and incomplete metadata throw before props are returned.

`Callable<Input>` describes required callback inputs. `RecipeCallable<Input>` permits omitted variant inputs. `From<Function>` retains published payload types while replacing web styling overrides with native overrides. Output uses `Native.Props<Style>` and retains the types of caller-owned `style` overrides, including animated values and opaque device colors.

Dynamic native bindings share the static compiler's scalar conversion rules. Complex CSS expressions, dynamic transforms and shadows, host-owned objects as payloads, and automatic device subscriptions remain outside this helper.
