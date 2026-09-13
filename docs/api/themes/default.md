# Default theme

The opt-in entrypoint exports bound `css` and `variants`, the full `theme` handle, and raw `tokens`. Vite and Next.js consume its packed compiler contract. Core imports do not load the bundled data.

```ts
import { css, variants } from 'zyzz/themes/default'

namespace styles {
  export const card = css({ color: 'blue.700', padding: 4 })
  export const button = variants({
    variants: { size: { sm: { padding: 2 }, lg: { padding: 4 } } },
    defaultVariants: { size: 'sm' },
  })
}
```

The opt-in bundle supplies Tailwind's palette, breakpoint, radius, and font-size scales, a quarter-rem spacing scale, scalar typography, and Geist/Geist Mono font stacks with system fallbacks. It does not download or register fonts. `foreground` and `surface` provide light/dark semantic colors.

Palette and scale data come from the pinned Tailwind dependency; its MIT notice is retained in `src/themes/LICENSE.tailwind`. Raw `tokens` are independent of `theme.tokens` portable references and `theme.vars` web references.

Themes can also define `breakpoints`, `containers`, and `containerNames`. These are compile-time query metadata, excluded from declaration references and emitted CSS variables. Thresholds use fixed nonnegative CSS lengths, with relative units preserved. Extensions may change existing thresholds; runtime theme scope changes do not change compiled thresholds. Nested condition authoring resolves aliases from these groups, including comparison and range forms.

The package includes its versioned `.zyzz.json` contract and generated declarations. Applications compile every finite recipe choice, including conditional selections and dynamic payload slots, through the ordinary theme pipeline. Fonts still require application-owned loading.
