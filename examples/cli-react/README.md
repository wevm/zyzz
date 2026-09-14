# React + Zyzz CLI

```sh
pnpm build
pnpm --dir examples/cli-react dev
```

Run from the repository root after `pnpm install`. The library build provides the `zyzz` binary; `pnpm examples` runs the same steps for every example.

Vite has no Zyzz plugin here. The CLI compiles `src` into `.zyzz`, and Vite bundles that compiled tree:

```sh
zyzz build --out-dir .zyzz && vite build
```

`scripts/dev.ts` compiles once, then runs `zyzz dev` beside `vite` so edits recompile and reload.

## Output Consumption

For `src/App.tsx`, the CLI emits `.zyzz/App.tsx` with rewritten style calls, `.zyzz/App.tsx.css`, source maps, and packed metadata. Shared contributions such as `global`, `keyframes`, and layer order land in `.zyzz/zyzz.shared.css`.

`index.html` is the consumer of that tree: it loads the shared stylesheet, then each module stylesheet, then the compiled entry module.

```html
<link rel="stylesheet" href="/.zyzz/zyzz.shared.css" />
<link rel="stylesheet" href="/.zyzz/App.tsx.css" />
<script type="module" src="/.zyzz/main.tsx"></script>
```

Authored source stays unaware of compiled artifacts. Relative imports inside compiled modules resolve within `.zyzz`, so this example keeps assets out of `src`; the Vite plugin examples show relative asset imports.

`vite.config.ts` adds `targets()` from `zyzz/vite`, a configuration-only plugin that supplies the browser targets `zyzz()` would otherwise supply. Without it, Vite's default target lowers `light-dark()` and inherited scheme changes stop working.

## Feature Map

| Source                  | Capabilities                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `src/zyzz.config.ts`    | Named themes, light/dark pairs, extensions, tokens, aliases, property-specific scales, layers    |
| `src/App.tsx`           | Theme selection, system scheme, nested scopes, global CSS in a named layer                       |
| `src/Styling.tsx`       | Literal reuse, object spread, fallbacks, importance, token/variable references, state, overrides |
| `src/Dynamic.tsx`       | Typed runtime inputs, `variable()`, registration, static and inline `variables`                  |
| `src/Relationships.tsx` | Empty `css()`, `selectors`, hover, data attributes, nth-child, sibling selectors, `:has()`       |
| `src/Motion.tsx`        | Local/imported keyframes, starting styles, reduced motion                                        |

See [CLI Setup](../../docs/introduction/cli.md) and the [CLI reference](../../docs/api/cli.md) for flags, `--css-only`, and structured output.
