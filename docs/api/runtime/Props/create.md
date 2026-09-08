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

`className`: complete compiler-produced class list. Applications accept only `className` and `style`.

## Returns

A `css.ReturnType` callable producing classes and copied inline overrides. No rules are generated.

## Errors

Applied unknown keys, invalid override records, non-string classes, and invalid style containers throw `TypeError`.

This is a generated-code support API. The example assumes the supplied class has a matching stylesheet; normal authoring uses `css`.

See [Props](README.md) for related methods and types.
