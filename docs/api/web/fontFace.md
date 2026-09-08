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

### definition

- Type: Static font-face descriptors
- Required: Yes.

Declared family, source, and other supported font-face descriptors. Relative URLs retain the owning source module.

```ts
fontFace({ fontFamily: 'App Sans', src: 'url("./app.woff2") format("woff2")' })
```

### definition.fontDisplay

- Type: CSS font-display value
- Default: CSS initial behavior (`auto`) when omitted.

Controls font display behavior while loading.

```ts
fontFace({
  fontDisplay: 'swap',
  fontFamily: 'App Sans',
  src: 'url("./app.woff2")',
})
```

### definition.fontFamily

- Type: Authored CSS font family
- Required: Yes.

Family name used by ordinary style declarations.

```ts
fontFace({ fontFamily: 'App Sans', src: 'url("./app.woff2")' })
```

### definition.src

- Type: CSS font source descriptor
- Required: Yes.

Font URL and optional format descriptor.

```ts
fontFace({ fontFamily: 'App Sans', src: 'url("./app.woff2") format("woff2")' })
```

## Returns

Contributes a stylesheet rule. A generated/private family return API remains undecided; styles use the declared family.

## Errors

Reject invalid descriptors and unsupported target semantics. Native font loading belongs to platform APIs.

See [Fonts and Motion](../../guides/stylesheets.md#fonts-and-motion) and [Global Styles](../../guides/stylesheets.md#global-styles).
