# Solid + Vite

```sh
pnpm examples
```

Run from the repository root after `pnpm install`. The command builds Zyzz, then starts every example's dev server. After building or linking, `pnpm dev` also works from this directory.

`vite-plugin-solid` handles JSX and Zyzz handles styles with `plugins: [zyzz(), solid()]`. The config selects `output: 'html'`, so applied styles return `class` and a serialized `style` string that Solid binds as native attributes.

```tsx
import { css } from './zyzz.config.js'

namespace styles {
  export const button = css({ color: 'accent', padding: 'md' })
}

export function Button() {
  return <button {...styles.button()}>Continue</button>
}
```

Spreads read signals inside the JSX, so `styles.bar({ width: `${amount()}%` })` updates its bound variable without re-rendering the element. Each module opens with `/** @jsxImportSource solid-js */` because the repository's shared tsconfig targets React's JSX runtime.

The root theme lives on `<html>`. The Vite plugin inlines the config's `script()` at the start of `index.html`'s head, so a saved selection applies before any module runs. `src/appearance.ts` creates `Appearance` from `zyzz/web`; the entry calls `restore()` for the defaults, and controls read `current()` and persist with `select()`.

## Feature Map

| Source                          | Capabilities                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/zyzz.config.ts`            | Named themes, light/dark pairs, extensions, tokens, aliases, property-specific scales, layers    |
| `src/appearance.ts`             | `Appearance` from `zyzz/web`: root theme and scheme on `<html>`, saved preferences               |
| `src/App.tsx`                   | Theme controls, nested scopes, global CSS in a named layer                                       |
| `src/Styling.tsx`               | Literal reuse, object spread, fallbacks, importance, token/variable references, state, overrides |
| `src/Dynamic.tsx`               | Typed runtime inputs, `variable()`, registration, static and inline `variables`                  |
| `src/Relationships.tsx`         | Empty `css()`, `selectors`, hover, data attributes, nth-child, sibling selectors, `:has()`       |
| `src/Queries.tsx`               | Media/container aliases, resize control, supports, scope boundaries                              |
| `src/Motion.tsx`                | Local/imported keyframes, relative assets, starting styles, reduced motion, keyed remount        |
| `src/App.tsx` / `src/index.tsx` | Global CSS, ordered layers, optional reset                                                       |

This client-rendered example does not demonstrate SSR hydration; the repository's Solid integration test covers server rendering through `vite-plugin-solid`.
