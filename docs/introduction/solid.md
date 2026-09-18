# Solid Setup

The consumer fixture covers shared TypeScript styles, SSR, hydration, signal updates, themes, development CSS edits, and production assets.

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

const { style } = Config.create({ output: 'html' })

namespace styles {
  export const bar = style((values: { width: `${number}%` }) => ({
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

The test fixture pins Solid 1.9.9 and vite-plugin-solid 2.11.8. Packed variants exercise defaults, payload updates and removal, conditional selections, SSR/hydration identity, production builds, and recovery after an invalid dependency edit.
