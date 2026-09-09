# global

Contribute eager global selectors and nested stylesheet rules.

```ts
import { global } from 'zyzz/web'

global({ '@layer base': { body: { margin: 0 } } })
```

Preview API; not yet implemented.

## Signature

`global(definition)`

## Parameters

### definition

- Type: Static selector maps and nested stylesheet rules
- Required: Yes.

Module-level selectors and supported at-rules. Discovery includes configured unimported modules.

```ts
global({ '@layer base': { body: { margin: 0 } } })
```

## Returns

Creates a retained stylesheet effect independent of JavaScript export usage. Watching replaces or removes contributions with their sources. The preview contract does not expose a return object.

## Errors

Reject invalid selectors, declarations, at-rules, and order cycles. Raw global layer names have no ambient config inference.

See [Fonts and Motion](../../guides/stylesheets.md#fonts-and-motion) and [Global Styles](../../guides/stylesheets.md#global-styles).
