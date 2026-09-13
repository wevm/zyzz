# Variant Payloads

`PayloadRecipe` is the compiler-facing dynamic-variant serializer exported from `zyzz/runtime`. Application code normally uses typed callbacks in [`variants`](../../core/variants.md).

| API      | Description                                                         |
| -------- | ------------------------------------------------------------------- |
| `create` | Normalize scoped selections and bind precompiled private variables. |

## create

```ts
import { PayloadRecipe, Recipe } from 'zyzz/runtime'

const definition = { axes: { size: ['custom'] }, defaults: {} }
const button = PayloadRecipe.create({
  ...definition,
  payloads: [
    { axis: 'size', choice: 'custom', slots: [{ padding: '--padding' }] },
  ],
  select: Recipe.create({ ...definition, className: 'button' }),
})
button({ size: { custom: { padding: '12px' } } })
```

### options.axes

Type: `Recipe.Definition['axes']`. Required ordered finite choice catalog, including static and dynamic choices.

### options.conditions

Type: `readonly string[] | undefined`. Optional ordered condition names. Slot index zero is the base context; index one corresponds to the first condition.

### options.defaultPayloads

Type: `Record<string, Record<string, string | number>> | undefined`. Optional complete scalar defaults keyed by axis, such as `{ size: { padding: '12px' } }`.

### options.defaults

Type: `Recipe.Definition['defaults']`. Required normalized default choice names. `{}` selects no defaults.

### options.html

Type: `boolean | undefined`. Optional; defaults to React-shaped output. `true` serializes HTML attributes after payload binding.

### options.payloads

Type: `readonly Recipe.Payload[]`. Required dynamic choices and fixed private-variable slots. For example, `{ axis: 'size', choice: 'custom', slots: [{ padding: '--padding' }] }` binds the base padding input.

### options.select

Type: `ReturnType<typeof Recipe.create>`. Required compiled selection delegate returning React-shaped props. Conditional variants use the compatible conditional-selection delegate supplied by compilation.

### Returned callable

Signature: `(input?: Record<string, unknown> & css.Options) => css.Props | Html.Attributes`. Input defaults to `{}`. Base selections use `{ size: { custom: { padding: '12px' } } }`; conditional selections nest under `conditions`. Styling overrides retain the ordinary application contract.

#### className / class

Type: `string`. Compiled and supplied classes use `className` for React or `class` for HTML.

#### data attributes

Type: ``Record<`data-${string}`, string>``. The delegate emits normalized choice names and scoped conditional selections, such as `'data-size': 'custom'`.

#### style

Type: `css.Props['style'] | string | undefined`. Active payload fields bind private variables alongside existing styles. Empty strings become whitespace; private assignments win collisions. HTML output serializes the final style once.

### Effects and errors

Initialization builds axis and choice lookup maps. Calls allocate normalized selections and fresh props. The serializer generates no CSS, executes no authoring callbacks, and performs no runtime validation. Compilation and TypeScript enforce finite choices and payload shapes; no dedicated runtime error class is introduced.
