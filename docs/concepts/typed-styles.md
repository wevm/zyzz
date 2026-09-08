# Typed Styles

Definitions describe static rules. Calling a definition returns styling props; it never creates CSS rules. Authoring calls require compilation.

```tsx
import { css } from 'zyzz'

const card = css({ padding: '1rem' })
const example = <div {...card()}>Card</div>
```
