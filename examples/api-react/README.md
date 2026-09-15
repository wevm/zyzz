# React + Compiler API

```sh
pnpm build
pnpm --dir examples/api-react dev
```

Run from the repository root after `pnpm install`. Node loads `zyzz/node` from the built package; `pnpm examples` runs the same steps for every example.

Neither the CLI nor a Vite plugin is involved. `scripts/build.ts` drives compilation through `Host` from `zyzz/node`, then bundles the compiled tree with Vite's JavaScript API:

```ts
import * as Vite from 'vite'
import { Host } from 'zyzz/node'

const host = await Host.create({
  packageId: 'api-react',
  root: Path.join(root, 'src'),
  script: Path.join(root, 'public/zyzz.js'),
})
try {
  await host.build()
} finally {
  await host.close()
}

await Vite.build({ build: { outDir: 'build' }, configFile: false, root })
```

The Host compiles into `dist` by default and writes the saved-selection script into `public`, so Vite serves it in development and copies it into the site. The site builds into `build` because `dist` belongs to the Host; `package.json` names that directory under `config.site` for the Examples workflow.

`scripts/dev.ts` uses `host.watch` instead, and the Vite dev server starts after the first successful build.

## Stylesheet

Each build publishes `dist/zyzz.css`: `zyzz.shared.css` first, then every module stylesheet with dependencies before their consumers. `index.html` links that one file, new source modules need no HTML edits, and the cascade follows import order. The per-module stylesheets and maps remain beside the compiled modules for library publishing.

```html
<script src="/zyzz.js"></script>
<link rel="stylesheet" href="/dist/zyzz.css" />
<script type="module" src="/dist/main.tsx"></script>
```

Authored source stays unaware of compiled artifacts. Relative imports inside compiled modules resolve within `dist`, so this example keeps assets out of `src`.

Vite runs with its default configuration. Its default CSS target lowers `light-dark()` into Lightning CSS helpers; the compiled scheme classes that `themes()` applies carry `color-scheme` in the stylesheet, so those helpers initialize and theme switching keeps working.

The root theme lives on `<html>`. The classic `<script src="/zyzz.js">` at the start of `<head>` applies a saved selection before paint in development and production. Controls read `appearance.get()` from the config and persist changes with `appearance.set()`; the default scheme comes from a global `html { color-scheme: light dark }` rule.

## Feature Map

| Source                  | Capabilities                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `scripts/build.ts`      | `Host.create`, `host.build`, artifact list, Vite `build`                                         |
| `scripts/dev.ts`        | `host.watch`, error events preserving the last output, Vite `createServer`                       |
| `src/zyzz.config.ts`    | Named themes, light/dark pairs, extensions, tokens, aliases, property-specific scales, layers    |
| `src/App.tsx`           | Root theme and scheme on `<html>` via `appearance`, nested scopes, global CSS in a named layer   |
| `src/Styling.tsx`       | Literal reuse, object spread, fallbacks, importance, token/variable references, state, overrides |
| `src/Dynamic.tsx`       | Typed runtime inputs, `variable()`, registration, static and inline `variables`                  |
| `src/Relationships.tsx` | Empty `css()`, `selectors`, hover, data attributes, nth-child, sibling selectors, `:has()`       |
| `src/Motion.tsx`        | Local/imported keyframes, starting styles, reduced motion                                        |

See [Host.create](../../docs/api/node/Host/create.md) for `css` processing options and the [compilation guide](../../docs/guides/compilation.md) for library publishing.
