# Next.js Setup

> [!NOTE]
> Preview integration. Packed applications are verified with Next.js 16.3.5 on Webpack and Turbopack, targeting Chromium 153. Default browser-target acceptance remains open.

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

namespace styles {
  export const title = css({ color: 'brand' })
  export const card = css({ padding: 'md' })
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

The acceptance fixture sets `"browserslist": ["Chrome 153"]` in the application package. Next.js's default target lowering currently produces unresolved helper variables for theme `light-dark()` values. Broader browser targets remain an acceptance blocker; this fixture does not establish support for those targets.

Real packed-consumer tests cover server and client components, hydration-driven updates, Fast Refresh, route navigation, imported theme edits, source diagnostics and recovery, relative fonts, and production CSS loading. Streaming tests observe the fallback before completed server output and verify its styles. Hydration preserves the original server button node.

See the [API reference](../api/next/zyzz.md) and [integration plan](../../.agents/plan.md#framework-integration-priority).
