# global

> [!NOTE]
> Preview API; not yet implemented.

Contribute eager global selectors and nested stylesheet rules.

```ts
import { global } from 'zyzz/web'

global({ '@layer base': { body: { margin: 0 } } })
```

## Signature

`global(definition)`

## Parameters

Module-level static selector maps and supported nested at-rules. Discovery includes configured unimported modules.

## Returns

A retained stylesheet effect, independent of JavaScript export usage. Watching replaces or removes contributions with their sources.

## Errors

Reject invalid selectors, declarations, at-rules, and order cycles. Raw global layer names have no ambient config inference.

See [Fonts and Motion](../../guides/motion.md) and [Global Styles](../../guides/stylesheets.md).
