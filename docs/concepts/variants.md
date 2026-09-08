# Variants

> [!NOTE]
> Preview API; not yet implemented.

A recipe styles one element and returns one props object. Axes, defaults, and compounds select precompiled alternatives. Multipart components use separate definitions with shared inputs; there is no slots option.

```tsx
import { variants } from 'zyzz'

const button = variants({
  variants: { size: { md: { padding: '1rem' }, sm: { padding: '0.5rem' } } },
})
const example = <button {...button({ size: 'sm' })}>Save</button>
```
