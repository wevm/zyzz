# Style.value

Carry precompiled classes through an element's `style` prop. Normal authoring uses [style](../../core/style.md); the compiler emits this helper.

```ts
import { Style } from 'zyzz/runtime'

const value = Style.value({ className: 'compiled-button' })
```

## Parameters

### props.className

- Type: `string`

Complete class list matching an emitted stylesheet. The supplied metadata is frozen.

## Returns

An immutable `style.ReturnType` consumed by [Style.resolve](resolve.md) at intrinsic JSX elements. No CSS rules are generated.
