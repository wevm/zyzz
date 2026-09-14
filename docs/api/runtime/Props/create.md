# Props.create

Bind compiled classes to the literal styling override contract.

```ts
import { Props } from 'zyzz/runtime'

const card = Props.create({ className: 'compiled-card' })
const props = card({ style: { padding: '1rem' } })
```

## Signature

`Props.create(options)`

## Parameters

### options.className

- Type: `string`
- Required: Yes.

Complete compiler-produced class list with a matching stylesheet. No rules are generated.

```ts
Props.create({ className: 'compiled-card' })
```

## Returns

The returned callable accepts the [application parameters](../../core/css.md#application-parameters). The properties below Callable belong to its applied result.

### Callable

- Type: `css.ReturnType`

Callable accepting className, style, and variables overrides. Variables merge into returned inline styles before explicit style overrides.

```ts
const props = card({ style: { padding: '1rem' } })
```

### className

- Type: `string`

Generated class list, including supplied external classes. Class-string order does not establish CSS precedence.

```ts
props.className
```

### style

- Type: `css.Props["style"]`

Forwarded inline overrides when supplied. Other component props remain on the element.

```ts
props.style
```

## Errors

Override shapes and values are checked by TypeScript. The runtime helper merges classes and forwards inline styles without validation.

This is a generated-code support API. The example assumes the supplied class has a matching stylesheet. Normal authoring uses `css`.

See [Props](README.md) for related methods and types.

Each call returns a fresh props object. When `style` is supplied, the returned
`style` is the same object. Treat it as immutable after passing it to a callable.
Dynamic styles create a new style object to add their private variables.
