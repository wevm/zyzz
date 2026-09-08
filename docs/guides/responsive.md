# Responsive Styles

> [!NOTE]
> Preview API; not yet implemented.

Define typed thresholds in config, then reference them in media and container conditions.

```ts
// zyzz.config.ts
import { Config } from 'zyzz'

export default Config.create({
  theme: {
    breakpoints: { tablet: '48rem' },
    containerNames: ['sidebar'],
    containers: { card: '24rem' },
    spacing: { md: '1rem', sm: '0.5rem' },
  },
})
```

```tsx
import config from './zyzz.config.js'

const region = config.css({
  containerName: 'sidebar',
  containerType: 'inline-size',
})
const content = config.css({
  padding: 'sm',
  '@container sidebar >=card': { display: 'grid' },
  '@media tablet': { padding: 'md' },
})
const example = (
  <aside {...region()}>
    <div {...content()}>Content</div>
  </aside>
)
```

Media thresholds measure the viewport; container thresholds measure the eligible ancestor. Aliases compile to literals, so switching theme scopes does not change them. Raw CSS queries and `@supports` remain supported design paths.
