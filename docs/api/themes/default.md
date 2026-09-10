# Default theme

Import `css`, `theme`, and raw `tokens` from `zyzz/themes/default`. The root entrypoint does not import this data. `variants` follows in Phase 3.

```ts
import { css } from 'zyzz/themes/default'

const body = css({
  color: 'foreground',
  fontFamily: 'sans',
  fontSize: 'base',
  padding: 4,
})
```

The opt-in bundle supplies Tailwind's palette, breakpoint, radius, and font-size scales, a quarter-rem spacing scale, scalar typography, and Geist/Geist Mono font stacks with system fallbacks. It does not download or register fonts. `foreground` and `surface` provide light/dark semantic colors.

Palette and scale data come from the pinned Tailwind dependency; its MIT notice is retained in `src/themes/LICENSE.tailwind`. Raw `tokens` are independent of `theme.tokens` portable references and `theme.vars` web references.

Themes can also define `breakpoints`, `containers`, and `containerNames`. These are compile-time query metadata, excluded from declaration references and emitted CSS variables. Thresholds use fixed nonnegative CSS lengths, with relative units preserved. Extensions may change existing thresholds; runtime theme scope changes do not change compiled thresholds. Nested condition authoring resolves aliases from these groups, including comparison and range forms.
