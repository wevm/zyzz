# React + Next.js

```sh
pnpm build
pnpm --dir examples/next-react dev
```

Run from the repository root after `pnpm install`. Next.js loads `zyzz/next` from the built package; `pnpm examples` runs the same steps for every example.

`next.config.ts` wraps the application configuration with `zyzz(nextConfig)`. The wrapper owns source transformation, CSS delivery, and dependency watching for Turbopack and Webpack, so `next dev`, `next build`, and `next start` need no other setup:

```ts
import { zyzz } from 'zyzz/next'

export default zyzz({})
```

The application renders on the server. It has no static site to publish, so `package.json` sets `config.site` to `false` and the Examples workflow builds it without a deployment.

## Document Shell

`app/layout.tsx` is a server component. It imports `zyzz/reset.css` as global CSS and inlines the configuration's `script()` in `<head>`, so the saved theme and scheme apply before paint. The script changes root classes before hydration, and `<html suppressHydrationWarning>` accepts that difference.

```tsx
import { script } from './zyzz.config'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: script() }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

`app/App.tsx` is a client component: `appearance.get()` reads the document, so the selection state initializes after hydration in an effect, and `appearance.set()` persists changes. Components imported by `App` become client modules without their own directive. Style definitions, `global()`, and `keyframes()` compile at build time in both server and client modules.

## Feature Map

| Source                  | Capabilities                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `app/zyzz.config.ts`    | Named themes, light/dark pairs, extensions, tokens, aliases, property-specific scales, layers    |
| `app/layout.tsx`        | Global reset import, inline `script()` restoration, hydration-safe root markup                   |
| `app/App.tsx`           | Root theme and scheme on `<html>` via `appearance`, nested scopes, global CSS in a named layer   |
| `app/Styling.tsx`       | Literal reuse, object spread, fallbacks, importance, token/variable references, state, overrides |
| `app/Dynamic.tsx`       | Typed runtime inputs, `variable()`, registration, static and inline `variables`                  |
| `app/Relationships.tsx` | Empty `style()`, `selectors`, hover, data attributes, nth-child, sibling selectors, `:has()`     |
| `app/Motion.tsx`        | Local/imported keyframes, starting styles, reduced motion                                        |

See [Next.js Setup](../../docs/introduction/next.md) and the [`zyzz/next` reference](../../docs/api/next/zyzz.md).
