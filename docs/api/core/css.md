# css

Legacy callable authoring. Prefer [style](style.md) for new code.

```tsx
import { css } from 'zyzz'

const button = css({ padding: '1rem' })
const example = <button {...button()} />
```

`css(declarations)` returns a callable accepting optional `className` and `style` overrides. Its result contains styling props for spreading. This API remains supported for existing consumers; new docs and examples use named `style` exports and the `style` prop.

Types: `css.ErrorType`, `css.Options`, `css.Props`, and `css.ReturnType`.
