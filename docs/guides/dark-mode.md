# Dark Mode

> [!NOTE]
> Preview API; not yet implemented.

Define light/dark values on each color leaf. Select the scheme with the ordinary CSS property.

```ts
// zyzz.config.ts
import { Config } from 'zyzz'

export default Config.create({
  theme: { color: { text: { dark: '#eee', light: '#111' } } },
})
```

```tsx
import config from './zyzz.config.js'

const text = config.css({ color: 'text' })
const example = (
  <section style={{ colorScheme: 'dark' }}>
    <p {...text()}>Hello</p>
  </section>
)
```

- **Explicit scheme:** use `light` or `dark`.
- **System preference:** use `light dark`.
- **Theme selection:** use a compatible theme scope independently of scheme.

See [Compile Themes](in-memory-themes.md) for the current in-memory equivalent.
