# Style.resolve

Resolve compiled style values into DOM props. The source compiler inserts this at intrinsic JSX elements with style attributes or spreads.

```ts
import { Style } from 'zyzz/runtime'

const props = Style.resolve({ className: 'external', style: styles.button })
```

## Parameters

### props

- Type: `Record<string, unknown>`

Complete element props, evaluated in authored order. Ordinary inline styles pass through unchanged. A compiled value contributes its class list; inline declarations alongside its metadata remain inline.

## Returns

Element props with compiled and external class names merged. The opaque metadata is removed from the inline style object. Other fields retain their values. Resolving already-resolved props is harmless.

Custom components can forward the original value to a compiled intrinsic element. Use this helper explicitly at uncompiled component boundaries when the component forwards DOM props. Opaque style values are not a JSON serialization format.
