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

Callable accepting only className and style overrides, and returning copied inline overrides.

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

Copied inline overrides when supplied. Other component props remain on the element.

```ts
props.style
```

## Errors

Applied unknown keys, invalid override records, non-string classes, and invalid style containers throw `TypeError`.

This is a generated-code support API. The example assumes the supplied class has a matching stylesheet; normal authoring uses `css`.

See [Props](README.md) for related methods and types.
