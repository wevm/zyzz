# Default theme

Preview: `zyzz/themes/default` is not published in this phase. The bundled dataset is retained internally; the public entrypoint will ship with bound `css`, `variants`, `theme`, and raw `tokens` after Phase 3 adds variants. Core and compiler imports do not load this data. The following examples describe that planned API.

```ts
import { css } from 'zyzz/themes/default'

const styles = {
  card: css({ color: 'blue.700', padding: 4 }),
}
```

The opt-in bundle supplies Tailwind's palette, breakpoint, radius, and font-size scales, a quarter-rem spacing scale, scalar typography, and Geist/Geist Mono font stacks with system fallbacks. It does not download or register fonts. `foreground` and `surface` provide light/dark semantic colors.

Palette and scale data come from the pinned Tailwind dependency; its MIT notice is retained in `src/themes/LICENSE.tailwind`. Raw `tokens` are independent of `theme.tokens` portable references and `theme.vars` web references.

Themes can also define `breakpoints`, `containers`, and `containerNames`. These are compile-time query metadata, excluded from declaration references and emitted CSS variables. Thresholds use fixed nonnegative CSS lengths, with relative units preserved. Extensions may change existing thresholds; runtime theme scope changes do not change compiled thresholds. Nested condition authoring resolves aliases from these groups, including comparison and range forms.
