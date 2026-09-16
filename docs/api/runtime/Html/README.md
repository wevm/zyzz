# Html

Convert compiled styling props to DOM attributes and escaped HTML text. These functions do not generate CSS or mutate their inputs.

| Function                | Purpose                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| `from(props)`           | Convert applied style props to attributes.                         |
| `serialize(attributes)` | Escape attributes for an HTML opening tag.                         |
| `bind(fn)`              | Adapt a compiled props callable to HTML output.                    |
| `create(options)`       | Create an HTML callable using [Props](../Props/README.md) options. |

## from

```ts
import { Html } from 'zyzz/runtime'

const attributes = Html.from({ className: 'z-card', style: { color: 'red' } })
```

### props

Type: applied `style.Props` with optional owned `data-*` attributes. Required. CSS values retain explicit units; custom-property names remain unchanged.

```ts
Html.from({ className: 'z-card', 'data-state': 'open' })
```

### class

Returned type: `string`. Compiled and external class names.

```ts
Html.from({ className: 'z-card' }).class // 'z-card'
```

### style

Returned type: `string | undefined`. Serialized declarations, present when input style exists. Values are unescaped attribute data; use the renderer or `serialize` for HTML escaping.

```ts
Html.from({ className: 'z-card', style: { color: 'red' } }).style // 'color:red'
```

### data attributes

Returned type: `string | undefined` for each `data-*` key. Owned data attributes pass through unchanged.

```ts
Html.from({ className: 'z-card', 'data-state': 'open' })['data-state']
```

## serialize

`Html.serialize(attributes)` returns a `string` of space-separated, quoted, escaped attributes. Omitted values do not produce attributes. Its required `attributes` parameter has the `Html.Attributes` shape returned by `from`.

```ts
const markup = `<article ${Html.serialize(attributes)}>Content</article>`
```

## Callable Adapters

`bind(fn)` requires a compiled function returning React-style `style.Props` and returns a function with the same input and HTML props output. `create(options)` accepts the required `Props.create.Options` object and returns a static HTML style callable. Both use `from` for output conversion.
