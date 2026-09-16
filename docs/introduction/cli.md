# CLI Setup

Compile source modules and stylesheets:

```sh
npx zyzz build
npx zyzz dev
```

Both commands read `src` and write transformed source modules, CSS, source maps, and packed metadata to `dist`. The compiler supplies automatic identities. Downstream tooling lowers the emitted TypeScript/JSX and bundles the application. `build` runs once; `dev` builds immediately and watches the source tree.

`dist/zyzz.css` holds every style the tree emits, ordered so shared contributions come first and each module's rules follow the modules it imports. Load it once from the document or import it from the entry module.

`dist/zyzz.js` restores the theme and scheme that `appearance.set()` saved for every configuration in the tree. Load it as a classic script at the start of `<head>` so the selection applies before paint. Bundlers that copy a public directory into the site serve that script from there through `--script public/zyzz.js`.

```html
<script src="/zyzz.js"></script>
<link rel="stylesheet" href="/dist/zyzz.css" />
<script type="module" src="/dist/main.tsx"></script>
```

## CSS Only

Disable source transformation and emit only CSS, CSS maps, and the initialization script:

```sh
npx zyzz build --css-only
npx zyzz dev --css-only
```

In this mode, build the original application source normally. Identity-bearing declarations require explicit IDs.

`zyzz.css` still collects the shared and module stylesheets in dependency order, so the document loads one file while the application continues importing its original source modules.

```ts
import { style, variable } from 'zyzz'

const accent = variable('color', { id: 'app-accent' })

export namespace styles {
  export const card = style({ color: accent, padding: '8px' })
}

// Spread styles.card({ variables: accent.set('red') }) on the element.
```

Ordinary static styles derive their class names from ordered declaration data. Without the compiler plugin, independent variables, empty or referenced style identities, dynamic styles, variants, themes, and named stylesheet declarations require explicit IDs.

```ts
const parent = style({}, { id: 'app-parent' })
const progress = style(
  (values: { width: `${number}px` }) => ({ width: values.width }),
  { id: 'app-progress' },
)
```

IDs belong to the application or package namespace. Reusing an ID deliberately shares an identity; conflicting style definitions are rejected during extraction. Runtime helpers bind classes, selection attributes, and inline variables. They do not insert stylesheets or generate CSS rules.

## Vite

The Vite integration extracts and delivers CSS automatically. Its compiler is enabled by default and supplies automatic identities, removes authoring definitions, and folds applications where possible.

```ts
import { zyzz } from 'zyzz/vite'

export default { plugins: [zyzz()] }
```

Disable source optimization while retaining CSS delivery:

```ts
export default { plugins: [zyzz({ compiler: false })] }
```

This mode follows the same explicit-ID requirements as `zyzz build --css-only`. The plugin and CLI are alternative CSS delivery paths; running both for the same application is unnecessary.

Bundlers consuming CLI output need no browser target configuration. Their default targets may lower `light-dark()` into Lightning CSS helpers; the compiled scheme classes applied by `themes()` carry `color-scheme` in the stylesheet, which initializes those helpers.

## Watching

Compilation errors preserve the last successful stylesheets and recover after valid edits. Ctrl-C and SIGTERM stop watching and release the output lock. Cleanup removes only unchanged owned artifacts and preserves unrelated files.

See the [CLI reference](../api/cli.md) for flags and structured output. The lower-level [Host API](../api/node/Host/create.md) retains module emission for library publishing and custom build pipelines.

## Runtime Cost

Source optimization removes authoring normalization from application bundles. In a minimal exported static-style fixture, minified JavaScript measured 285 bytes gzip with compilation and 18,271 bytes gzip without it. This is a fixture measurement, not a fixed per-style cost; normalization is shared across definitions. Compilation stays enabled by default in Vite.
