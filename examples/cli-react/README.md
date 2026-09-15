# React + Zyzz CLI

```sh
pnpm build
pnpm --filter ./examples/cli-react rebuild
pnpm --dir examples/cli-react dev
```

Run from the repository root after `pnpm install`. The library build provides the `zyzz` binary, and the rebuild step links it into this package: pnpm creates the shim only when its target exists, and a fresh install runs before the first build. `pnpm examples` runs the same steps for every example.

Vite has no Zyzz plugin here. The CLI compiles `src` into `dist`, writes the saved-selection script into `public`, and Vite bundles that compiled tree into `build`:

```sh
zyzz build --script public/zyzz.js && vite build
```

`scripts/dev.ts` compiles once, then runs `zyzz dev` beside `vite` so edits recompile and reload. `vite.config.ts` only moves the site to `build`, because `zyzz build` owns `dist`; `package.json` names that directory under `config.site` for the Examples workflow.

## Output Consumption

For `src/App.tsx`, the CLI emits `dist/App.tsx` with rewritten style calls, `dist/App.tsx.css`, source maps, and packed metadata. Shared contributions such as `global`, `keyframes`, and layer order land in `dist/zyzz.shared.css`, and `dist/zyzz.css` collects the shared stylesheet followed by every module stylesheet with dependencies before their consumers.

`index.html` is the consumer of that tree: it loads the saved-selection script, links `zyzz.css`, and loads the compiled entry module. New source modules need no HTML edits, and an App rule cascades over an imported component rule that sets the same property because `App.tsx` styles follow the components it imports.

```html
<script src="/zyzz.js"></script>
<link rel="stylesheet" href="/dist/zyzz.css" />
<script type="module" src="/dist/main.tsx"></script>
```

Authored source stays unaware of compiled artifacts. Relative imports inside compiled modules resolve within `dist`, so this example keeps assets out of `src`; the Vite plugin examples show relative asset imports.

Vite runs with its default configuration. Its default CSS target lowers `light-dark()` into Lightning CSS helpers; the compiled scheme classes that `themes()` applies carry `color-scheme` in the stylesheet, so those helpers initialize and theme switching keeps working.

The root theme lives on `<html>`. `--script public/zyzz.js` writes the compiled initialization where Vite serves and copies it verbatim, and the classic `<script>` at the start of `<head>` applies a saved selection before paint in development and production. Controls read `appearance.get()` from the config and persist changes with `appearance.set()`; the default scheme comes from a global `html { color-scheme: light dark }` rule.

## Feature Map

| Source                  | Capabilities                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `src/zyzz.config.ts`    | Named themes, light/dark pairs, extensions, tokens, aliases, property-specific scales, layers    |
| `src/App.tsx`           | Root theme and scheme on `<html>` via `appearance`, nested scopes, global CSS in a named layer   |
| `src/Styling.tsx`       | Literal reuse, object spread, fallbacks, importance, token/variable references, state, overrides |
| `src/Dynamic.tsx`       | Typed runtime inputs, `variable()`, registration, static and inline `variables`                  |
| `src/Relationships.tsx` | Empty `css()`, `selectors`, hover, data attributes, nth-child, sibling selectors, `:has()`       |
| `src/Motion.tsx`        | Local/imported keyframes, starting styles, reduced motion                                        |

See [CLI Setup](../../docs/introduction/cli.md) and the [CLI reference](../../docs/api/cli.md) for flags, `--css-only`, and structured output.
