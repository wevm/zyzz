# zyzz/web

Compile web CSS and declare stylesheet contributions and element relationships.

| API                       | Description                                                    |
| ------------------------- | -------------------------------------------------------------- |
| [Css](Css/README.md)      | Pure web CSS emission.                                         |
| [fontFace](fontFace.md)   | Contribute a static font-face rule.                            |
| [global](global.md)       | Contribute eager global selectors and nested stylesheet rules. |
| [keyframes](keyframes.md) | Define an animation with a stable typed name reference.        |
| [layers](layers.md)       | Contribute ordered cascade layer names.                        |

| [ancestor](ancestor.md) | Match a marked ancestor. |
| [anySibling](anySibling.md) | Match a marked sibling in either direction. |
| [descendant](descendant.md) | Match a marked descendant. |
| [ref](ref.md) | Define a callable element identity with optional typed states. |
| [siblingAfter](siblingAfter.md) | Match a marked sibling following the styled element. |
| [siblingBefore](siblingBefore.md) | Match a marked sibling preceding the styled element. |

## At-Rule Functions

> [!NOTE]
> The [complete at-rule API](at-rules.md) tracks implementation and acceptance separately; full conformance is not yet established.

`counterStyle`, `fontPaletteValues`, and `positionTry` emit named descriptor rules and return typed CSS identities. Each accepts optional ordered `{ within }` grouping contexts. Imports, aliases, re-exports, and packed metadata preserve the identities.

`page`, `fontFeatureValues`, and `viewTransition` emit eager document rules with ordered grouping contexts. Page-margin boxes and font-feature aliases use distinct descriptor bodies.

Additional direct imports include `cssFunction`, `customMedia`, `importCss`, and `namespace`. Conditional/grouping rules remain native keys in valid style bodies. Registration extends `Vars.define`.

```ts
import { css } from 'zyzz'
import { cssFunction, customMedia, importCss } from 'zyzz/web'

importCss({ url: './reset.css', layer: 'reset' })
const compact = customMedia('(width < 40rem)')
const double = cssFunction({
  parameters: [{ name: '--size', syntax: '<length>' }],
  returns: '<length>',
  body: { result: 'calc(var(--size) * 2)' },
})
namespace styles {
  export const box = css({
    width: double('2rem'),
    [compact]: { display: 'none' },
  })
}
```

These helpers emit native CSS; they do not polyfill experimental browser features. CSS functions currently accept individual scalar syntax domains, not composite `type(...)` signatures. Namespaces are local to their declaring source module, including packed output. Generated CSS is UTF-8 without a BOM or `@charset` declaration. Legacy `@document` remains an explicit grouping key; browser availability is separate from extraction.

> [!NOTE]
> `colorProfile` is planned and remains unexported until real-browser rendering is verified.
