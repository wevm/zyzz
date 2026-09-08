# Share Styles

> [!NOTE]
> Preview API; not yet implemented.

Keep exported definitions in an ordinary source module and import them where needed. Config remains an explicit dependency.

```ts
import { css } from './zyzz.config.js'

// button.styles.ts

export const button = css({ padding: 'md' })
```

```tsx
// Button.tsx
import { button } from './button.styles.js'

export function Button() {
  return <button {...button()}>Save</button>
}
```

The bundler integration resolves and transforms source imports. Consumers never import generated component copies. For precompiled packages, follow [Publish Libraries](compilation.md).
