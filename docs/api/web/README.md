# zyzz/web

Compile web CSS and declare stylesheet contributions and element relationships.

| API                       | Description                                                    |
| ------------------------- | -------------------------------------------------------------- |
| [Css](Css/README.md)      | Pure web emission and typed stylesheet relationships.          |
| [fontFace](fontFace.md)   | Contribute a static font-face rule.                            |
| [global](global.md)       | Contribute eager global selectors and nested stylesheet rules. |
| [keyframes](keyframes.md) | Define an animation with a stable typed name reference.        |
| [layers](layers.md)       | Contribute ordered cascade layer names.                        |

## At-Rule Functions

> [!NOTE]
> The [complete at-rule API](at-rules.md) is an accepted design; statement and document helpers remain planned.

`counterStyle`, `fontPaletteValues`, and `positionTry` emit named descriptor rules and return typed CSS identities. Each accepts optional ordered `{ within }` grouping contexts. Imports, aliases, re-exports, and packed metadata preserve the identities.

Planned direct imports include `cssFunction`, `customMedia`, `fontFeatureValues`, `importCss`, `namespace`, `page`, and `viewTransition`. Conditional/grouping rules remain native keys in valid style bodies. Registration extends `Vars.define`.

> [!NOTE]
> `colorProfile` is planned and remains unexported until real-browser rendering is verified.
