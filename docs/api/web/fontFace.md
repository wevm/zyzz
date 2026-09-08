# fontFace

> [!NOTE]
> Preview API; not yet implemented.

Contribute a static font-face rule.

```ts
import { fontFace } from 'zyzz/web'

fontFace({
  fontDisplay: 'swap',
  fontFamily: 'App Sans',
  src: 'url("./app.woff2") format("woff2")',
})
```

## Signature

`fontFace(definition)`

## Parameters

Static font-face descriptors, including an authored family and source. Relative URLs retain the owning source module.

## Returns

A stylesheet contribution. A generated/private family return API remains undecided; use the declared family in styles.

## Errors

Reject invalid descriptors and unsupported target semantics. Native font loading belongs to platform APIs.

See [Fonts and Motion](../../guides/motion.md) and [Global Styles](../../guides/stylesheets.md).
