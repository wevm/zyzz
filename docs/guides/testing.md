# Testing & Migration

Verify rendered behavior, diagnose failures, and migrate existing components. Begin with [Getting Started](../introduction/getting-started.md) to connect compilation.

See [Web acceptance](web-acceptance.md) for current fixture coverage, reproduction commands, and known limits.

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

An error named `style.MissingTransformError` means authoring source reached execution. The name identifies the diagnostic; the constructor is not a property of the exported `style` function. Confirm the build transforms that module; importing config or extracting CSS alone cannot fix it.

#### Missing CSS

Ensure code and stylesheet come from the same compilation. Load the emitted CSS through the build integration or a stylesheet link.

#### Unknown Tokens

Import the intended config and check the token's property domain. Root `style` has no built-in tokens. Optional themes must be narrowed before shorthand names can infer.

#### Unexpected Overrides

Check layer, importance, condition, and rule order. Class-string order does not determine precedence. Use supported styling overrides or `cx` composition.

#### Watch Failures

Inspect the located error and keep the last successful output. Do not delete unrelated output files; the host tracks ownership.

See [Compatibility](../introduction/compatibility.md) before assuming a preview API is executable.

### Migration

For Tailwind CSS v4, follow [Migrating from Tailwind](tailwind.md) for configuration, utility styles, source discovery, and incremental migration.

For StyleX, follow [Migrating from StyleX](stylex.md) for definitions, composition, variables, themes, and incremental migration.

Migrate one component and its computed styles at a time. Preserve layout, states, theme behavior, and CSS delivery before expanding adoption.

| Existing Approach        | Zyzz Authoring                          |
| ------------------------ | --------------------------------------- |
| Utility strings          | Typed properties in `style` definitions |
| Theme-specific utilities | Config-bound token names                |
| Variant helpers          | Bound `variants` choices and compounds  |
| Runtime style factories  | Typed value callbacks with fixed rules  |

```tsx
import { style } from 'zyzz'

namespace styles {
  export const card = style({ padding: '1rem' })
}
const example = <div {...styles.card()}>Card</div>
```

External CSS remains subject to its authored specificity and layers. Do not assume previous class-order overrides or component wrappers translate automatically. Use the [comparison](../introduction/comparisons.md) and [compatibility inventory](../introduction/compatibility.md) to identify unsupported cases.
