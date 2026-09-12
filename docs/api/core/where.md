# where

`where` templates interpolate `css()` definitions without calling them. `&` selects the styled element; combinators, pseudo-classes, attributes, and `:has()` retain ordinary CSS semantics. Apply the referenced definition through its normal style props. An empty `css({})` supplies identity without declarations.

```ts
import { css, where } from 'zyzz'

namespace styles {
  export const card = css({})
  export const label = css({
    [where`${card}:hover &`]: { color: 'blue' },
    [where`${card}[data-state="open"] > &`]: { opacity: 1 },
    [where`${card} > &:nth-child(even)`]: { opacity: 0.5 },
  })
}
```

References retain their identity through local aliases, namespace members, named imports/re-exports, and packed libraries. Selector grammar is checked during compilation. TypeScript checks interpolation identities and nested declaration values; it does not validate selector text or prove DOM structure.

Specificity follows the authored selector. Use explicit `:where(...)` to lower condition specificity. Application-owned state remains in ordinary data/ARIA attributes. No runtime selector parsing, DOM lookup, or CSS generation is involved.

## Signature

`where(strings, ...references)` is used as a tagged template inside a computed `css` key.

## Parameters

### strings

- Type: `TemplateStringsArray`

Literal selector fragments containing an explicit `&` target. Each selector-list branch must be scoped.

### references

- Type: `readonly where.Reference[]`

Previously declared `css` definitions, including configured and dynamic definitions. Interpolate the definition itself, not applied props, arbitrary functions, or selector strings.

## Returns

An opaque computed style key. Extraction replaces the template with a CSS selector containing stable class identities.

## Errors

Unresolved or forward references, called definitions, invalid selectors, and templates outside compiled style keys fail at build time. Untransformed execution throws `css.MissingTransformError`. Native styles do not support DOM relationships.
