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

The bundle mirrors Tailwind's default theme for every scale the theme contract supports and takes its colors and font stacks from the Geist design system. It does not download or register fonts.

| Group           | Keys                                                                                                                                                                       | Source                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `color`         | `amber`, `blue`, `gray`, `grayAlpha`, `green`, `pink`, `purple`, `red`, `teal` in steps `100` to `1000`, `background.100`/`200`, `black`, `white`, `foreground`, `surface` | Geist                                |
| `fontFamily`    | `sans`, `mono`, `serif`                                                                                                                                                    | Geist stacks over Tailwind fallbacks |
| `fontSize`      | `xs` to `9xl`                                                                                                                                                              | Tailwind                             |
| `fontWeight`    | `thin` to `black`                                                                                                                                                          | Tailwind                             |
| `letterSpacing` | `tighter` to `widest`                                                                                                                                                      | Tailwind                             |
| `lineHeight`    | `tight`, `snug`, `normal`, `relaxed`, `loose`                                                                                                                              | Tailwind                             |
| `spacing`       | `px`, `0` to `96` whole steps of `0.25rem`                                                                                                                                 | Tailwind                             |
| `borderRadius`  | `xs` to `4xl`                                                                                                                                                              | Tailwind                             |
| `breakpoints`   | `sm` to `2xl`                                                                                                                                                              | Tailwind                             |
| `containers`    | `3xs` to `7xl`                                                                                                                                                             | Tailwind                             |

Geist color steps are light/dark pairs and switch with the ordinary color-scheme contract. Steps whose Geist values match in both schemes are single colors. `foreground` aliases `gray.1000` and `surface` aliases `background.100`. `grayAlpha` steps are translucent eight-digit hex values for overlays and borders.

Tailwind's fractional spacing steps (`0.5`, `1.5`, `2.5`, `3.5`) are omitted because token paths reserve the dot separator. Tailwind groups outside the theme contract (shadows, blur, easing, animation, perspective, and paired font-size line heights) are not bundled. `sans` and `mono` lead with Geist and Geist Mono before Tailwind's system stacks. `serif` is Tailwind's stack because Geist provides no serif face.

Scale data comes from the pinned Tailwind dependency, and its MIT notice is retained in `src/themes/LICENSE.tailwind`. Color values follow the published Geist design system. Raw `tokens` are independent of `theme.tokens` portable references and `theme.vars` web references.

Themes can also define `breakpoints`, `containers`, and `containerNames`. These are compile-time query metadata, excluded from declaration references and emitted CSS variables. Thresholds use fixed nonnegative CSS lengths, with relative units preserved. Extensions may change existing thresholds; runtime theme scope changes do not change compiled thresholds. Nested condition authoring resolves aliases from these groups, including comparison and range forms.

The package includes its versioned `.zyzz.json` contract and generated declarations. Applications compile every finite recipe choice, including conditional selections and dynamic payload slots, through the ordinary theme pipeline. Fonts still require application-owned loading.

## css

Signature: `theme.css(styles)`. Accepts a static style object or typed value callback with bundled token inference. Returns a callable producing `className` and optional `style` props. The [css parameters and returns](../core/css.md) apply; untransformed execution throws `css.MissingTransformError`.

```ts
const card = css({ padding: 4 })
card({ className: 'external' })
```

## variants

Signature: `theme.variants(definition)`. Accepts base styles, ordered axes, defaults, compounds, named conditions, and typed dynamic choices. Returns a recipe callable with inferred selections and styling overrides. See [variants parameters, returns, and errors](../core/variants.md). Authoring requires compilation; runtime selection performs no validation.

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

Type: the literal bundled token record. It takes no parameters and contains raw values and query metadata; reading it has no authoring error. `theme.tokens` carries portable references and `theme.vars` carries variable references instead.

```ts
const color = tokens.color.blue[700]
```

## Package lifecycle

`pnpm build`, `pnpm dev`, and `pnpm changeset:publish` generate the theme module and adjacent compiler contract. Development replaces the generated theme link without changing its source. Run `pnpm build` before direct integration test commands; test workers share these read-only artifacts.
