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
> The [complete at-rule API](at-rules.md) is an accepted design; statement helpers remain planned.

`colorProfile`, `counterStyle`, `fontPaletteValues`, and `positionTry` emit named descriptor rules and return typed CSS identities. Each accepts optional ordered `{ within }` grouping contexts. Imports, aliases, re-exports, and packed metadata preserve the identities.

`page`, `fontFeatureValues`, and `viewTransition` emit eager document rules with ordered grouping contexts. Page-margin boxes and font-feature aliases use distinct descriptor bodies.

Planned direct imports include `cssFunction`, `customMedia`, `importCss`, and `namespace`. Conditional/grouping rules remain native keys in valid style bodies. Registration extends `Vars.define`.
