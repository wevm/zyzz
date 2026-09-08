# Fonts and Motion

> [!NOTE]
> Preview API; not yet implemented.

Declare fonts and keyframes near their owning code. Disable nonessential motion when reduced motion is requested.

```ts
import { css } from 'zyzz'
import { fontFace, keyframes } from 'zyzz/web'

fontFace({
  fontDisplay: 'swap',
  fontFamily: 'App Sans',
  src: 'url("./app.woff2") format("woff2")',
})
const enter = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
const notice = css({
  animationDuration: '160ms',
  animationName: enter,
  fontFamily: '"App Sans", sans-serif',
  '@media (prefers-reduced-motion: reduce)': { animationName: 'none' },
})
```

Font URLs retain source ownership. Reachable keyframes emit stable references. Frame bodies contain declarations only; no importance or nested selectors/queries. Native font loading and animations require platform-specific behavior.
