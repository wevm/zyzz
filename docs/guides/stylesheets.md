# Add Global Styles, Fonts, and Motion

Place stylesheet contributions beside the code that owns them. This example imports `css` from the [theme config](themes.md#configure-authoring).

> [!NOTE]
> Preview API; not yet implemented.

```ts
import { fontFace, global, keyframes } from 'zyzz/web'
import { css } from './zyzz.config.js'

global({
  '@layer base': {
    body: { fontFamily: '"App Sans", sans-serif', margin: 0 },
  },
})

fontFace({
  fontDisplay: 'swap',
  fontFamily: 'App Sans',
  src: 'url("./fonts/app.woff2") format("woff2")',
})

const enter = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
})
export const notice = css({
  animationDuration: '160ms',
  animationName: enter,
  '@media (prefers-reduced-motion: reduce)': { animationName: 'none' },
})
```

- **Collection:** place static declarations at module scope in configured source files.
- **Effects:** globals and fonts survive bundling; reachable keyframes retain stable names.
- **Layers:** standalone strings receive compiler validation, without config-bound TypeScript inference.
- **Runtime:** the host collects CSS without executing application code.
