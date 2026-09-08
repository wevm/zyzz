# zyzz

Typed style definitions, themes, configuration, and callable authoring.

> [!NOTE]
> `Config`, `cx`, `variants`, and `Vars` are preview APIs and are not exported at this baseline. Only `css`, `Style`, and `Theme` are implemented root exports.

| API                        | Description                                                            |
| -------------------------- | ---------------------------------------------------------------------- |
| [Config](Config/README.md) | Configuration-bound authoring and compatible theme scopes.             |
| [css](css.md)              | Define callable styles that compile to static CSS and styling props.   |
| [cx](cx.md)                | Compose applied generated styles while retaining their owned bindings. |
| [Style](Style/README.md)   | Ordered style data and validation.                                     |
| [Theme](Theme/README.md)   | Immutable scalar tokens and compatible extensions.                     |
| [variants](variants.md)    | Define finite style choices for one element.                           |
| [Vars](Vars/README.md)     | Explicit shared variable contracts.                                    |
