---
'zyzz': patch
---

Fixed `zyzz/vite` rejecting server builds with a Node target, such as `build: { ssr: true, target: 'node20' }`. Server environments now skip the CSS target check, and a client build fails only when its emitted CSS contains `light-dark()` and a CSS target would lower it or names no browser. When `build.cssTarget` is unset and `build.target` names no browser, such as `node20` or `es2022`, CSS targets default to Chrome/Edge 123, Firefox 120, and Safari 17.5.
