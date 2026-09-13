# React + Vite

```sh
pnpm examples
```

Run from the repository root after `pnpm install`. No provider, generated component, custom JSX runtime, or manual CSS collection is required. Vite handles JSX and Zyzz handles styles with `plugins: [zyzz()]`. The modern-browser playground preserves native CSS with `build.cssTarget: 'esnext'`, including `light-dark()` for runtime scheme selection.

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

| Source                           | Capabilities                                                                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/zyzz.config.ts`             | Named themes, light/dark pairs, extensions, tokens, aliases, property-specific scales, cascade layers                                                    |
| `src/App.tsx`                    | Theme selection, system scheme, nested scopes, responsive layout                                                                                         |
| `src/Styling.tsx`                | Literal reuse, object spread, fallbacks, importance, token/variable references, state, overrides                                                         |
| `src/Dynamic.tsx`                | Typed runtime inputs, shared variables, registration, inherited assignments                                                                              |
| `src/Relationships.tsx`          | Empty `css()`, `where`, hover, data attributes, nth-child, sibling selectors, `:has()`                                                                   |
| `src/Queries.tsx`                | Media/container aliases, resize control, supports, scope boundaries                                                                                      |
| `src/Motion.tsx`                 | Local/imported keyframes, relative assets, starting styles, reduced motion                                                                               |
| `src/Stylesheets.tsx`            | Counter styles, fonts, pages, margin boxes, cross-document view transition opt-in                                                                        |
| `src/Advanced.tsx`               | CSS functions, custom media, ICC profile, palettes, OpenType sets, namespace selectors, CSS imports, explicit layers, registered angle, anchor fallbacks |
| `src/Styles.ts` / `src/main.tsx` | Imported definitions, global CSS, ordered layers, optional reset                                                                                         |

Each example keeps styles beside its component and spreads normal props onto native elements. Advanced stylesheet descriptors follow browser support; print rules are visible in print preview.

`variants`, `cx`, default-theme imports, and native output remain separate implementation work. This client-rendered example does not demonstrate SSR hydration or the optional saved-preference initialization script. Compiler/CLI and packed-library workflows remain in the [compilation guide](../../docs/guides/compilation.md).

`src/srgb.icc` is the Little CMS built-in sRGB profile used by the repository conformance fixture. Its embedded copyright permits free use. Font palette/feature examples are authored descriptors with system-font fallbacks; no color font is bundled.
