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
> The [complete at-rule API](at-rules.md) is an accepted design; new helpers are not implemented.

Planned direct imports include `colorProfile`, `counterStyle`, `cssFunction`, `customMedia`, `fontFeatureValues`, `fontPaletteValues`, `importCss`, `namespace`, `page`, `positionTry`, and `viewTransition`. Conditional/grouping rules remain native keys in valid style bodies. Registration extends `Vars.define`.
