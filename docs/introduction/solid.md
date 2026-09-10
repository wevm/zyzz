# Solid Setup

> [!NOTE]
> Integration verification is in progress. The consumer fixture covers shared TypeScript styles, SSR, hydration, signal updates, themes, development CSS edits, and production assets.

Keep the Solid plugin and add Zyzz before it:

```ts
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { zyzz } from 'zyzz/vite'

export default defineConfig({
  plugins: [zyzz(), solid({ ssr: true })],
})
```

Apply compiled styles through the DOM adapter inside the reactive JSX expression:

```tsx
import { createSignal } from 'solid-js'
import { css } from 'zyzz'
import { Attrs } from 'zyzz/web'

const styles = {
  bar: css((values: { width: `${number}%` }) => ({
    height: '20px',
    width: values.width,
  })),
}

export function Progress() {
  const [width, setWidth] = createSignal<`${number}%`>('25%')
  return <div {...Attrs.from(styles.bar({ width: width() }))} />
}
```

`Attrs.from` supplies `class` and a CSS style string, including dynamic custom properties. Keep signal reads in the JSX expression so updates reach the element. React-style camel-case inline overrides are serialized by the adapter.

The test fixture pins Solid 1.9.9 and vite-plugin-solid 2.11.8. Packed-library coverage and the remaining lifecycle recovery gates are tracked in the implementation plan.
