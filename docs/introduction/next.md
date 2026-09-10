# Next.js Setup

> [!NOTE]
> Preview API; not yet implemented. Webpack and Turbopack support require separate integration verification.

Wrap the existing Next.js configuration with the `zyzz` integration. The wrapper owns source transformation, CSS delivery, and dependency watching.

```ts
// next.config.ts
import { zyzz } from 'zyzz/next'

export default zyzz({
  reactStrictMode: true,
})
```

Define the application's named config helpers as shown in [Getting Started](getting-started.md#define-config). Components keep ordinary source imports:

```tsx
import { css } from './zyzz.config.js'

const styles = {
  card: css({ padding: 'md' }),
}

export default function Page() {
  return <main {...styles.card()}>Hello</main>
}
```

The function from `zyzz/next` configures the build. The instance from `zyzz.config.ts` supplies typed authoring helpers and theme handles.

- **Development:** the existing Next.js dev command rebuilds styles after source and imported config/theme edits.
- **Production:** the existing Next.js build command emits transformed modules and matching CSS for server and client rendering.
- **Setup:** no separate Babel or PostCSS configuration, generated component imports, or manual virtual stylesheet import is required by the proposed contract.

The integration must preserve existing Next.js options and compose with existing build hooks and rules. Loader or transform selection is an internal implementation decision; both bundlers reuse Zyzz's compiler.

Support requires real fixtures for Server Components, client components, Fast Refresh, theme edits, route navigation, streaming, and production CSS loading. Preview notes remain until the supported Next.js versions and bundler paths pass those gates.

See the [API reference](../api/next/zyzz.md) and [integration plan](../../.agents/plan.md#phase-4--integrations-and-distribution).
