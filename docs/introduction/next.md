# Next.js Setup

> [!NOTE]
> Verified with Next.js 16.3.4 App Router applications on webpack and Turbopack: production builds, Server Components, client components, streaming, hydration, route navigation, Fast Refresh, imported config edits, and failure recovery. The Pages Router, relative stylesheet assets, and unimported stylesheet contributions are not covered yet.

Wrap the existing Next.js configuration with the `zyzz` integration. The wrapper owns source transformation, CSS delivery, and dependency watching for both bundlers.

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
  export const card = css({ padding: 'md' })
}

export default function Page() {
  return <main {...styles.card()}>Hello</main>
}
```

The function from `zyzz/next` configures the build. The named helpers from `zyzz.config.ts` supply typed authoring and theme handles.

- **Development:** `next dev` and `next dev --webpack` rebuild styles after source and imported config/theme edits through Fast Refresh; client state survives style edits.
- **Production:** `next build` and `next build --webpack` emit transformed modules and matching CSS for Server Components, client components, and streamed segments.
- **Setup:** no separate Babel or PostCSS configuration, generated component imports, or manual stylesheet import is required.

Existing options, `turbopack.rules`, and a `webpack` hook are preserved; the wrapper appends its own loader rules after them. Configuration objects are required: asynchronous and function-valued configurations throw a `TypeError`.

## Delivery

Each transformed module imports the stylesheets of its reachable source graph, dependencies first. Under webpack these are stylesheet requests answered by the loader; under Turbopack they are inline `data:` stylesheets. Both flow through the Next.js CSS pipeline, so route chunks and `<link>` tags follow the normal App Router behavior.

Stylesheet contributions such as `global`, `layers`, `keyframes`, and `fontFace` are collected from modules reachable through static imports. Import contribution modules from the root layout or another rendered module; unimported files are not scanned. Shared contributions may repeat per importing module before minification.

Light/dark token pairs emit `light-dark()`. Next.js lowers it to scheme helper variables unless the project `browserslist` targets browsers that support it, such as `chrome 123`, `firefox 128`, and `safari 17.5`. Zyzz does not override the host's target policy.

## Diagnostics

Extraction and compiler errors carry their source locations and surface in the Next.js development overlay for the importing module. Restoring the source recovers without restarting the server. Relative stylesheet assets referenced by contributions are rejected with an explicit error.

Applied React props type `style` with the Zyzz property contract rather than `React.CSSProperties`; spreading them onto JSX elements type-checks at runtime boundaries but not yet under `@types/react`. The integration fixture disables Next.js build-time type checking for that reason and checks consumer types separately.

See the [API reference](../api/next/zyzz.md) and [implementation plan](../../.agents/plan.md#framework-integration-priority).
