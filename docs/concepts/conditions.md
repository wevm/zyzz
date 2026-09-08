# Conditions

> [!NOTE]
> Preview API; not yet implemented.

Pseudo styles, media queries, container queries, and feature queries keep their CSS meaning. Nested conditions combine with AND while preserving property/token inference.

```ts
import { css } from 'zyzz'

const button = css({
  ':hover': { '@media (hover: hover)': { opacity: 0.8 } },
})
```

Query aliases resolve from theme metadata to literal conditions. Theme scope changes do not change query thresholds. Container queries select the nearest eligible container; raw queries still require compiler validation.

See [Responsive Styles](../guides/responsive.md) and [Style States](../guides/states.md).
