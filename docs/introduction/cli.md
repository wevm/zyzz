# CLI Setup

Extract styles while building the original application source normally:

```sh
npx zyzz build
npx zyzz dev
```

Both commands read `src` and write CSS and CSS source maps to `dist`. They do not write rewritten TypeScript, JavaScript, declarations, or module metadata. `build` runs once; `dev` builds immediately and watches the source tree.

Load `zyzz.shared.css` when present, followed by the emitted module stylesheets. The application continues importing its original source modules.

```ts
import { css, variable } from 'zyzz'

const accent = variable('color', { id: 'app-accent' })

export namespace styles {
  export const card = css({ color: accent, padding: '8px' })
}

// Spread styles.card({ variables: accent.set('red') }) on the element.
```

Ordinary static styles derive their class names from ordered declaration data. Without the compiler plugin, independent variables, empty or referenced style identities, dynamic styles, variants, themes, and named stylesheet declarations require explicit IDs.

```ts
const parent = css({}, { id: 'app-parent' })
const progress = css(
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

This mode follows the same explicit-ID requirements as the standalone CLI. The plugin and CLI are alternative CSS delivery paths; running both for the same application is unnecessary.

## Watching

Compilation errors preserve the last successful stylesheets and recover after valid edits. Ctrl-C and SIGTERM stop watching and release the output lock. Cleanup removes only unchanged owned artifacts and preserves unrelated files.

See the [CLI reference](../api/cli.md) for flags and structured output. The lower-level [Host API](../api/node/Host/create.md) retains module emission for library publishing and custom build pipelines.

## Runtime Cost

Source optimization removes authoring normalization from application bundles. In a minimal exported static-style fixture, minified JavaScript measured 285 bytes gzip with compilation and 18,271 bytes gzip without it. This is a fixture measurement, not a fixed per-style cost; normalization is shared across definitions. Compilation stays enabled by default in Vite.
