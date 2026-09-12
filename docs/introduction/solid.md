# Solid Setup

> [!NOTE]
> Integration verification is in progress. The consumer fixtures cover shared TypeScript styles, SSR, hydration, signal updates, themes, development CSS edits, production assets, packed-library consumers, and rename/remove/recreate recovery of style modules under the dev server.

Keep the Solid plugin and add Zyzz before it:

```ts
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { zyzz } from 'zyzz/vite'

export default defineConfig({
  plugins: [zyzz(), solid({ ssr: true })],
})
```

Select HTML output once in the shared configuration, then spread applied styles inside the reactive JSX expression:

```tsx
import { createSignal } from 'solid-js'
import { Config } from 'zyzz'

const { css } = Config.create({ output: 'html' })

namespace styles {
  export const bar = css((values: { width: `${number}%` }) => ({
    height: '20px',
    width: values.width,
  }))
}

export function Progress() {
  const [width] = createSignal<`${number}%`>('25%')
  return <div {...styles.bar({ width: width() })} />
}
```

`output: 'html'` supplies `class` and a CSS style string, including dynamic custom properties. Keep signal reads in the JSX expression so updates reach the element. React-style camel-case inline overrides are serialized by compiled bindings.

Styles may also come from a packed library that exports an HTML-output `css` and `theme`; see [Theme Libraries](vite.md#theme-libraries) for the metadata layout. The library's stylesheet loads once and application styles receive matching scopes.

The test fixture pins Solid 1.9.9 and vite-plugin-solid 2.11.8. Render benchmarks measure React only; the implementation plan tracks the remaining Solid benchmark gate.
