# zyzz

Typed style definitions, themes, configuration, and callable authoring.

> [!NOTE]
> `Config`, `Props`, `style`, `cx`, `Style`, `Vars`, `variable`, and `variants` are exported. `selectors` is a style property. Config source extraction and theme variable references are supported. `cx` composes known local applications, including payloads and conditional arguments. Packed composition is supported; arbitrary external props remain unsupported. Root and bound recipes support finite choices, media/supports selections, and scoped dynamic payloads.

| API                                          | Description                                                            |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| [Config](Config/README.md)                   | Configuration-bound authoring and compatible theme scopes.             |
| [style](style.md)                            | Define callable styles that compile to static CSS and styling props.   |
| [cx](cx.md)                                  | Compose applied generated styles while retaining their owned bindings. |
| [Props.Variants](variants.md#inferred-props) | Infer recipe selections and styling overrides.                         |
| [Style](Style/README.md)                     | Ordered style data and validation.                                     |
| [Vars](Vars/README.md)                       | Shared variable sets, conditional values, and scoped selection.        |
| [variants](variants.md)                      | Define finite style choices for one element.                           |
| [variable](variable.md)                      | Explicit shared variable contracts.                                    |

| [selectors](selectors.md) | Reference style definitions in scoped selector templates. |

Style declarations support ordered nonempty fallback arrays and trailing `!`/`!important`; see [Literal Values](Style/literals.md).
