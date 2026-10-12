---
'zyzz': patch
---

Fixed `cx` failing with `Composition requires statically known local style applications` when a selector interpolation or composition entry also read an applied definition, such as `${styles.row}:hover &` inside `namespace styles`. Template selector keys outside `selectors` now report that they require a selectors object at the key.
