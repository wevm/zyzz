# Testing & Migration

Verify rendered behavior, diagnose failures, and migrate existing components. Begin with [Getting Started](../introduction/getting-started.md) to connect compilation.

## Recipes

### Test Styles

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

### Troubleshooting

#### Missing Transform

`css.MissingTransformError` means authoring source reached execution. Confirm the build transforms that module; importing config or extracting CSS alone cannot fix it.

#### Missing CSS

Ensure code and stylesheet come from the same compilation. Load the emitted CSS through the build integration or a stylesheet link.

#### Unknown Tokens

Import the intended config and check the token's property domain. Root `css` has no built-in tokens. Optional themes must be narrowed before shorthand names can infer.

#### Unexpected Overrides

Check layer, importance, condition, and rule order. Class-string order does not determine precedence. Use supported styling overrides or planned `cx` composition.

#### Watch Failures

Inspect the located error and keep the last successful output. Do not delete unrelated output files; the host tracks ownership.

See [Compatibility](../introduction/compatibility.md) before assuming a preview API is executable.

### Migration

Migrate one component and its computed styles at a time. Preserve layout, states, theme behavior, and CSS delivery before expanding adoption.

| Existing Approach        | Zyzz Authoring                         |
| ------------------------ | -------------------------------------- |
| Utility strings          | Typed properties in `css` definitions  |
| Theme-specific utilities | Config-bound token names               |
| Variant helpers          | Bound `variants` choices and compounds |
| Runtime style factories  | Typed value callbacks with fixed rules |

```tsx
import { css } from 'zyzz'

const card = css({ padding: '1rem' })
const example = <div {...card()}>Card</div>
```

External CSS remains subject to its authored specificity and layers. Do not assume previous class-order overrides or component wrappers translate automatically. Use the [comparison](../introduction/comparisons.md) and [compatibility inventory](../introduction/compatibility.md) to identify unsupported cases.
