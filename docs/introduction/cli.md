# CLI Setup

Precompile source modules and CSS with one command:

```sh
npx zyzz build
npx zyzz watch
```

Both commands read `src`, write rewritten modules to `dist`, and emit `dist/styles.css`, relative to the working directory. `build` runs once; `watch` builds immediately and rebuilds after source or dependency changes.

Override paths only when needed:

```sh
npx zyzz build app --out-dir build --css build/app.css
```

Point the application build at the rewritten output and load its stylesheet. Downstream tooling handles TypeScript/JSX lowering. Libraries publish matching modules, CSS, and declarations. See [Build & Delivery](../guides/compilation.md#standalone-output).

Watch errors preserve the previous complete output. Cleanup only removes owned artifacts; output is excluded from source discovery.

See the [CLI reference](../api/cli.md) for optional flags. Authoring uses normal source imports; no config is required for token-free styles.

## Style Props

The CLI uses the same source transform as the Vite plugin. Static declarations are extracted into CSS; style values carry the generated class names through component props. At intrinsic JSX elements, an emitted runtime helper moves those classes into `className` and keeps native inline overrides in `style`.

```tsx
import { style } from 'zyzz'

const styles = { button: style({ color: '#06c' }) }

export function Button() {
  return <button style={{ ...styles.button, opacity: 0.5 }}>Save</button>
}
```

The rendered element has a generated class and inline `opacity: 0.5`. The helper generates no CSS at runtime. Consume the rewritten modules from `dist` and load `dist/styles.css`; using the original source bypasses this transformation.
