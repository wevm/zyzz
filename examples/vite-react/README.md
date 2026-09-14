# React + Vite

```sh
pnpm examples
```

Run from the repository root after `pnpm install`. The command builds Zyzz, then starts every example's dev server. Vite’s config runner also loads the source-linked TypeScript plugin after `pnpm dev`.

Vite handles JSX and Zyzz handles styles with `plugins: [zyzz()]`. After building or linking, `pnpm dev` also works from this directory.

```tsx
import { css } from './zyzz.config.js'

namespace styles {
  export const button = css({ color: 'accent', padding: 'md' })
}

export function Button() {
  return <button {...styles.button()}>Continue</button>
}
```

## Feature Map

| Source                         | Capabilities                                                                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/zyzz.config.ts`           | Named themes, light/dark pairs, extensions, tokens, aliases, property-specific scales, cascade layers                                                    |
| `src/appearance.ts`            | `Appearance` from `zyzz/web`: root theme and scheme on `<html>`, saved preferences                                                                       |
| `src/App.tsx`                  | Theme controls, nested scopes, responsive layout                                                                                                         |
| `src/Styling.tsx`              | Literal reuse, object spread, fallbacks, importance, token/variable references, state, overrides                                                         |
| `src/Dynamic.tsx`              | Typed runtime inputs, `variable()`, registration, static and inline `variables`, inherited assignments                                                   |
| `src/Relationships.tsx`        | Empty `css()`, `selectors`, hover, data attributes, nth-child, sibling selectors, `:has()`                                                               |
| `src/Queries.tsx`              | Media/container aliases, resize control, supports, scope boundaries                                                                                      |
| `src/Motion.tsx`               | Local/imported keyframes, relative assets, starting styles, reduced motion                                                                               |
| `src/Stylesheets.tsx`          | Counter styles, fonts, pages, margin boxes, cross-document view transition opt-in                                                                        |
| `src/Advanced.tsx`             | CSS functions, custom media, ICC profile, palettes, OpenType sets, namespace selectors, CSS imports, explicit layers, registered angle, anchor fallbacks |
| `src/App.tsx` / `src/main.tsx` | Global CSS, ordered layers, optional reset                                                                                                               |

Each example keeps styles beside its component and spreads normal props onto native elements. Advanced stylesheet descriptors follow browser support; print rules are visible in print preview.

The root theme lives on `<html>`. The Vite plugin inlines the config's `script()` at the start of `index.html`'s head, so a saved selection applies before any module runs. `src/appearance.ts` creates `Appearance` from `zyzz/web`; the entry calls `restore()` for the defaults, and controls read `current()` and persist with `select()`.

`variants`, `cx`, default-theme imports, and native output remain separate implementation work. This client-rendered example does not demonstrate SSR hydration. The [cli-react](../cli-react) and [api-react](../api-react) examples cover CLI and compiler-API workflows; packed-library workflows remain in the [compilation guide](../../docs/guides/compilation.md).

`src/srgb.icc` is the Little CMS built-in sRGB profile used by the repository conformance fixture. Its embedded copyright permits free use. Font palette/feature examples are authored descriptors with system-font fallbacks; no color font is bundled.
