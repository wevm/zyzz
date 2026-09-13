# zyzz

Typed style definitions, themes, configuration, and callable authoring.

> [!NOTE]
> `Config`, `css`, `Style`, `Theme`, `variable`, and `variants` are exported. `selectors` is a style property. Config source extraction and theme variable references are supported. `cx` remains a preview API. Root and theme/config-bound variants support static choices; Named conditional recipes are supported.

| API                        | Description                                                            |
| -------------------------- | ---------------------------------------------------------------------- |
| [Config](Config/README.md) | Configuration-bound authoring and compatible theme scopes.             |
| [css](css.md)              | Define callable styles that compile to static CSS and styling props.   |
| [cx](cx.md)                | Compose applied generated styles while retaining their owned bindings. |
| [Style](Style/README.md)   | Ordered style data and validation.                                     |
| [Theme](Theme/README.md)   | Immutable scalar tokens and compatible extensions.                     |
| [variants](variants.md)    | Define finite style choices for one element.                           |
| [variable](variable.md)    | Explicit shared variable contracts.                                    |

| [selectors](selectors.md) | Reference style definitions in scoped selector templates. |

Style declarations support ordered nonempty fallback arrays and trailing `!`/`!important`; see [Literal Values](Style/literals.md).
