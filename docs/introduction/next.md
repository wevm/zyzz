# Next.js Setup

Packed applications are verified with Next.js 16.3.5 on Webpack and Turbopack, rendering in Chromium 153 with default build targets. Client JavaScript source maps trace packed variant applications to their authored call sites.

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
import { style } from './zyzz.config'

namespace styles {
  export const title = style({ color: 'brand' })
  export const card = style({ padding: 'md' })
}

export default function Page() {
  return (
    <main {...styles.card()}>
      <h1 {...styles.title()}>Hello</h1>
    </main>
  )
}
```

The function from `zyzz/next` configures the build. Named exports from `zyzz.config.ts` supply typed authoring helpers and theme handles.

- **Development:** the existing Next.js dev command rebuilds styles after source and imported config/theme edits.
- **Production:** the existing Next.js build command emits transformed modules and matching CSS for server and client rendering.
- **Setup:** no separate Babel or PostCSS configuration, generated component imports, or manual virtual stylesheet import is required.

The wrapper preserves existing options and composes Webpack hooks and Turbopack rules. Configuration objects, promises, and phase callbacks are accepted, including asynchronous callbacks. It creates `.zyzz/next` for bundler-owned CSS; exclude this directory from version control.

The wrapper excludes `light-dark()` from Next.js CSS lowering while preserving other configured feature settings. Theme variables need native color-scheme selection; the lowering otherwise introduces unresolved helper variables. Default build targets are verified in Chromium 153. Browsers without native `light-dark()` remain unsupported; excluding lowering is not a polyfill.

Real packed-consumer tests cover server and client components, hydration-driven updates, Fast Refresh, route navigation, imported theme edits, source diagnostics and recovery, relative fonts, and production CSS loading. Streaming tests observe the fallback before completed server output and verify its styles. Hydration preserves the original server button node.

See the [API reference](../api/next/zyzz.md) and [integration plan](../../.agents/plan.md#web-acceptance).

Packed variants exercise defaults, payload updates, conditional selections, and composition in both bundlers. Client JavaScript maps trace the authored application; emitted module CSS maps retain source identities.
