# Default config

The opt-in `zyzz/default` entrypoint exports `appearance`, `script`, `style`, `vars`, and `variants` from a default `Config.create` configuration, plus raw `tokens`. Vite and Next.js consume its packed compiler contract. Core imports do not load the bundled data.

```ts
import { style, variants } from 'zyzz/default'

namespace styles {
  export const card = style({ color: 'blue.700', padding: 4 })
  export const button = variants({
    variants: { size: { sm: { padding: 2 }, lg: { padding: 4 } } },
    defaultVariants: { size: 'sm' },
  })
}
```

The non-font scales follow [Tailwind CSS 4.3.3](https://github.com/tailwindlabs/tailwindcss/blob/v4.3.3/packages/tailwindcss/theme.css). Font scales and Geist typography retain their existing values. Fonts require application-owned loading.

| Group           | Keys                                                                       |
| --------------- | -------------------------------------------------------------------------- |
| `color`         | Tailwind palette families in steps `50` to `950`, plus `black` and `white` |
| `fontFamily`    | `sans`, `mono`, `serif`                                                    |
| `fontSize`      | `xs` to `9xl`                                                              |
| `fontWeight`    | `thin` to `black`                                                          |
| `letterSpacing` | `tighter` to `widest`                                                      |
| `lineHeight`    | `tight`, `snug`, `normal`, `relaxed`, `loose`                              |
| `typography`    | Geist `heading`, `button`, `label`, and `copy` sets                        |
| `spacing`       | `px` and the existing whole-number quarter-rem steps through `96`          |
| `radius`        | `xs` to `4xl`                                                              |
| `breakpoint`    | `sm` to `2xl`                                                              |
| `container`     | `3xs` to `7xl`                                                             |
| `aspect`        | `video`                                                                    |
| `shadow`        | `2xs` to `2xl`, `inner`                                                    |
| `insetShadow`   | `2xs`, `xs`, `sm`                                                          |
| `dropShadow`    | `xs` to `2xl`                                                              |
| `textShadow`    | `2xs` to `lg`                                                              |
| `blur`          | `xs` to `3xl`                                                              |
| `perspective`   | `dramatic`, `near`, `normal`, `midrange`, `distant`                        |
| `ease`          | `in`, `out`, `in-out`                                                      |
| `animate`       | `spin`, `ping`, `pulse`, `bounce`, with keyframes                          |

Rename category keys `borderRadius`, `breakpoints`, and `containers` to `radius`, `breakpoint`, and `container`. Style declarations still use CSS property names such as `borderRadius`.

Palette values stay the same across color schemes. Define application-specific light/dark pairs when needed. The former Geist palette aliases (`foreground`, `surface`, `background`, and `grayAlpha`) are not included.

Spacing remains an explicit table. Numeric names resolve only when present; no scalar `DEFAULT` multiplier is used. Fractional names are omitted because dots separate token paths. Use semantic names or literal CSS lengths for additional steps.

Use `boxShadow: 'md'`, `textShadow: 'sm'`, `aspectRatio: 'video'`, `perspective: 'near'`, `transitionTimingFunction: 'out'`, and `animation: 'spin'` for mapped effects. Blur, drop shadows, and inset shadows remain explicit CSS references:

```ts
import { style, vars } from 'zyzz/default'

namespace styles {
  export const frosted = style({
    filter: `blur(${vars.blur.md})`,
    boxShadow: vars.insetShadow.sm,
  })
}
```

See [category fallbacks](./core/Vars/README.md#category-fallbacks) for the lookup order. Font-related mappings and typography behavior remain unchanged, including no spacing fallback for `lineHeight`.

`breakpoint` and `containerNames` are query metadata without declaration references. `container` supplies both container-query thresholds and sizing variables. Extensions may change existing thresholds; selecting a runtime scope does not change compiled queries.

Third-party scale data retains its MIT notice under `src/themes/`. Raw `tokens` are independent of `vars` references.

The package includes its versioned `.zyzz.json` contract and generated declarations. Applications compile every finite recipe choice, including conditional selections and dynamic payload slots, through the ordinary theme pipeline. Fonts still require application-owned loading.

## appearance

`appearance.get()` reads the root color scheme. `appearance.set({ colorScheme: 'dark' })` updates and persists it under the default `zyzz` storage key. The [appearance contract](./core/Config/create.md#appearance) applies.

## script

`script()` returns HTML-safe JavaScript for restoring the saved color scheme before first paint. Include it in an inline script in the document head. It shares the `zyzz` storage key with `appearance`.

```ts
import { script } from 'zyzz/default'

const initialization = script()
```

## style

### Typography sets

Named sets follow [Geist typography](https://vercel.com/geist/typography). Each applies `fontFamily`, `fontSize`, `fontWeight`, `letterSpacing`, and `lineHeight`. Sizes, line heights, and heading tracking match Geist's pixel values. Other sets reset letter spacing to `0px`.

```ts
import { style } from 'zyzz/default'

namespace styles {
  export const title = style({ typography: 'heading.32' })
  export const body = style({ typography: 'copy.14', fontWeight: 500 })
  export const code = style({ typography: 'label.14.mono' })
}
```

Explicit typography fields in the same block override preset fields regardless of their position. Presets also work in selectors, conditions, and variant choices. `typography: 'heading.32 !important'` marks its expanded fields important.

| Set       | Sizes                                  | Variants                                           |
| --------- | -------------------------------------- | -------------------------------------------------- |
| `button`  | 12, 14, 16                             | None                                               |
| `copy`    | 13, 14, 16, 18, 20, 24                 | `.mono` on 13; `.strong` on 14, 16, 18, 20, 24     |
| `heading` | 14, 16, 20, 24, 32, 40, 48, 56, 64, 72 | `.subtle` on 16, 20, 24, 32                        |
| `label`   | 12, 13, 14, 16, 18, 20                 | `.mono` on 12, 13, 14; `.strong` on 12, 13, 14, 16 |

Variants are complete sets, such as `copy.14.strong`. They change typography only. Geist's descendant colors, capitalization, and tabular-number treatments remain explicit style declarations. No descendant selectors or font loading are installed.

Individual fields remain available through `vars.typography.heading[32].fontSize`. [Vars.extend](./core/Vars/README.md) overrides existing fields while preserving inherited theme references.

### Signature

Signature: `style(styles)`. Accepts a static style object or typed value callback with bundled token inference. Returns a callable producing `className` and optional `style` props. The [style parameters and returns](./core/style.md) apply; untransformed execution throws `style.MissingTransformError`.

```ts
const card = style({ padding: 4 })
card({ className: 'external' })
```

## variants

Signature: `variants(definition)`. Accepts base styles, ordered axes, defaults, compounds, named conditions, and typed dynamic choices. Returns a recipe callable with inferred selections and styling overrides. See [variants parameters, returns, and errors](./core/variants.md). Authoring requires compilation; runtime selection performs no validation.

```ts
const button = variants({ variants: { size: { sm: { padding: 2 } } } })
button({ size: 'sm' })
```

## vars

The callable reference tree from the default configuration. Use `vars.color.blue[700]` for an explicit reference, and call `vars({ colorScheme: 'dark' })` to apply its scope. The default configuration has one set, so it accepts no `set` option.

```tsx
<section {...vars({ colorScheme: 'dark' })}>Content</section>
```

## tokens

Type: the literal bundled token record. It takes no parameters and contains raw values and query metadata; reading it has no authoring error. `vars` carries typed references.

```ts
const color = tokens.color.blue[700]
```

## Package lifecycle

`pnpm build` and `pnpm dev` generate the theme module and adjacent compiler contract. Development replaces the generated theme link without changing its source. Run `pnpm build` before direct integration test commands; test workers share these read-only artifacts.
