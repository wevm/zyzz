# zyzz

Typed style values, themes, and configuration.

| API                        | Description                                                            |
| -------------------------- | ---------------------------------------------------------------------- |
| [Config](Config/README.md) | Configuration-bound authoring and compatible theme scopes.             |
| [style](style.md)          | Define static values for the compiled JSX style prop.                  |
| [css](css.md)              | Legacy callable authoring for existing spread applications.            |
| [cx](cx.md)                | Compose applied generated styles while retaining their owned bindings. |
| [Style](Style/README.md)   | Ordered style data and validation.                                     |
| [Theme](Theme/README.md)   | Immutable scalar tokens and compatible extensions.                     |
| [variants](variants.md)    | Define finite style choices for one element.                           |
| [Vars](Vars/README.md)     | Explicit shared variable contracts.                                    |

Style declarations support ordered nonempty fallback arrays and trailing `!`/`!important`; see [Literal Values](Style/literals.md).

`Config`, `style`, `Style`, and `Theme` are exported. Config source extraction and named bound `style` exports are implemented. `cx`, `variants`, and `Vars` remain preview APIs and are not exported.
