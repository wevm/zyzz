# Test Styles

Test the compiled application through a real renderer. Pair type checks with observable browser behavior.

```ts
import { Style } from 'zyzz'
import { Css } from 'zyzz/web'

const styles = Style.define({ card: { padding: '1rem' } })
const output = Css.compile({ styles })
```

1. Load `output.css` in the browser fixture.
2. Apply `output.classes.card` to the rendered card.
3. Check computed padding and relevant states.
4. Verify source errors through public diagnostics.

Use integration tests without mocks or stubs. Snapshot results individually with inline snapshots; match only genuinely nondeterministic fields. A stylesheet snapshot alone does not prove cascade or rendering correctness.
