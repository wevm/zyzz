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

Palette and scale data come from the pinned Tailwind dependency. Its MIT notice is retained in `src/themes/LICENSE.tailwind`. Raw `tokens` are independent of `theme.tokens` portable references and `theme.vars` web references.

Themes can also define `breakpoints`, `containers`, and `containerNames`. These are compile-time query metadata, excluded from declaration references and emitted CSS variables. Thresholds use fixed nonnegative CSS lengths, with relative units preserved. Extensions may change existing thresholds. Runtime theme scope changes do not change compiled thresholds. Nested condition authoring resolves aliases from these groups, including comparison and range forms.

The package includes its versioned `.zyzz.json` contract and generated declarations. Applications compile every finite recipe choice, including conditional selections and dynamic payload slots, through the ordinary theme pipeline. Fonts still require application-owned loading.

## css

Signature: `theme.css(styles)`. Accepts a static style object or typed value callback with bundled token inference. Returns a callable producing `className` and optional `style` props. The [css parameters and returns](../core/css.md) apply. Untransformed execution throws `css.MissingTransformError`.

```ts
const card = css({ padding: 4 })
card({ className: 'external' })
```

## variants

Signature: `theme.variants(definition)`. Accepts base styles, ordered axes, defaults, compounds, named conditions, and typed dynamic choices. Returns a recipe callable with inferred selections and styling overrides. See [variants parameters, returns, and errors](../core/variants.md). Authoring requires compilation. Runtime selection performs no validation.

```ts
const button = variants({ variants: { size: { sm: { padding: 2 } } } })
button({ size: 'sm' })
```

## theme

Type: `Theme.Definition<typeof tokens>`. Exposes the compiled `className`, bound `css` and `variants`, token references, and variable references. It takes no parameters. The [Theme return properties](../core/Theme/define.md#returns) describe each member. Apply its class to an ancestor of token-consuming styles.

```tsx
<section className={theme.className}>Content</section>
```

## tokens

Type: the literal bundled token record. It takes no parameters and contains raw values and query metadata. Reading it has no authoring error. `theme.tokens` carries portable references and `theme.vars` carries variable references instead.

```ts
const color = tokens.color.blue[700]
```

## Package lifecycle

`pnpm build`, `pnpm dev`, and `pnpm changeset:publish` generate the theme module and adjacent compiler contract. Development replaces the generated theme link without changing its source. Run `pnpm build` before direct integration test commands. Test workers share these read-only artifacts.
