# fontFace

> [!NOTE]
> Initial compiler support: direct named imports and module-level literal calls.

Contribute a static font-face rule.

```ts
import { fontFace } from 'zyzz/web'

fontFace({
  fontDisplay: 'swap',
  fontFamily: 'App Sans',
  src: 'url("/app.woff2") format("woff2")',
})
```

## Signature

`fontFace(definition, context = {})`

## Parameters

### definition

- Type: Static font-face descriptors
- Required: Yes.

Declared family, source, and other supported font-face descriptors. URLs may be relative to the contributing source, root-relative, or absolute.

```ts
fontFace({ fontFamily: 'App Sans', src: 'url("/app.woff2") format("woff2")' })
```

### definition.fontDisplay

- Type: CSS font-display value
- Default: CSS initial behavior (`auto`) when omitted.

Controls font display behavior while loading.

```ts
fontFace({
  fontDisplay: 'swap',
  fontFamily: 'App Sans',
  src: 'url("/app.woff2")',
})
```

### definition.fontFamily

- Type: Authored CSS font family
- Required: Yes.

Family name used by ordinary style declarations.

```ts
fontFace({ fontFamily: 'App Sans', src: 'url("/app.woff2")' })
```

### definition.src

- Type: CSS font source descriptor
- Required: Yes.

Font URL and optional format descriptor.

```ts
fontFace({ fontFamily: 'App Sans', src: 'url("/app.woff2") format("woff2")' })
```

## Returns

Contributes a stylesheet rule. A generated/private family return API remains undecided; styles use the declared family.

## Errors

Reject invalid descriptors and unsupported target semantics. Native font loading belongs to platform APIs.

See [Fonts and Motion](../../guides/stylesheets.md#fonts-and-motion) and [Global Styles](../../guides/stylesheets.md#global-styles).

## Current compiler boundary

Direct named imports from `zyzz/web` compile to static stylesheet data. `global`, `fontFace`, and `layers` are eager across supplied graph modules. Vite scans physical project source under its root, excluding generated directories, tests, and dependencies; the standalone host scans its configured source tree. `Graph.compile` returns one `sharedCss` artifact, and the standalone host writes `zyzz.shared.css`, loaded before module stylesheets. Vite imports one shared virtual stylesheet automatically.

Local keyframes use stable module-and-binding names; unused local definitions are omitted and exported names remain live. Imported and re-exported animations retain their identity through packed metadata. Relative URLs resolve against the contributing source; Node publishes assets and Vite handles their production URLs. Shared CSS includes source maps and packed contributions. Opt into the reset with `import 'zyzz/reset.css'`.

## Enclosing contexts

Enclose definitions with nested `@layer`, `@media`, `@supports`, or `@container` keys. Outer keys emit outer groups. A flat definition uses stylesheet scope. Anonymous `@layer` groups are supported. The optional second argument accepts an explicit `id`.

```ts
fontFace({
  '@layer fonts': {
    '@supports font-tech(variations)': {
      fontFamily: 'Body',
      src: 'url(/body.woff2)',
    },
  },
})
```

Descriptors include `fontFeatureSettings` and `fontVariationSettings`, alongside family, source, display, style, stretch, weight, Unicode range, size adjustment, and metric overrides.

## Package fonts in Vite

The Vite adapter resolves a missing source-relative font URL through Vite's package resolver. Package exports and aliases apply. Development serves the font locally; production emits a bundled asset. Other hosts retain their existing relative-asset behavior.

```ts
import { fontFace } from 'zyzz/web'

fontFace({
  fontDisplay: 'swap',
  fontFamily: 'Geist',
  fontStyle: 'normal',
  fontWeight: '100 900',
  src: 'url("@fontsource-variable/geist/files/geist-latin-wght-normal.woff2") format("woff2")',
})
```
