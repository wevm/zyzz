# At-Rules

> [!NOTE]
> Grouping, font, named descriptor, page, view-transition, and statement helpers are implemented. Full conformance is tracked separately.

Stylesheet declarations use direct named imports from `zyzz/web`. Conditional and grouping rules remain native `@…` keys in valid style contexts. `global` owns global selectors and their grouping rules; descriptor and statement rules have dedicated functions.

## Functions

Signatures below describe the accepted call shapes. Multi-field helpers receive one named object parameter. New public TypeScript type names and unresolved options remain provisional.

| CSS rule               | Authoring                                                                | Result                                               |
| ---------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------- |
| `@charset`             | UTF-8 output without BOM or generated encoding declaration               | Output metadata                                      |
| `@color-profile`       | `colorProfile(descriptors, context?)`                                    | Typed profile reference                              |
| `@container`           | `'@container …'` in style bodies                                         | Nested declarations or selectors                     |
| `@counter-style`       | `counterStyle(descriptors, context?)`                                    | Typed counter-style reference                        |
| `@custom-media`        | `customMedia(query)`                                                     | Typed query reference                                |
| `@document`            | Explicit legacy grouping support; helper/context spelling to be designed | Conditional global rules                             |
| `@font-face`           | `fontFace(descriptors, context?)`                                        | Eager stylesheet effect                              |
| `@font-feature-values` | `fontFeatureValues({ families, features }, context?)`                    | Font-family-associated stylesheet effect             |
| `@font-palette-values` | `fontPaletteValues(descriptors, context?)`                               | Typed palette reference                              |
| `@function`            | `cssFunction(definition)`                                                | Callable CSS function reference                      |
| `@import`              | `importCss({ layer, media, supports, url })`                             | Ordered stylesheet import                            |
| `@keyframes`           | `keyframes(frames, context?)`                                            | Typed animation reference                            |
| `@layer`               | `layers(names)` and declared `'@layer …'` keys                           | Layer order and grouped rules                        |
| `@media`               | `'@media …'` in style bodies                                             | Nested declarations or selectors                     |
| `@namespace`           | `namespace({ prefix, uri })`; omit `prefix` for the default namespace    | Stylesheet namespace declaration                     |
| `@page`                | `page({ descriptors, selector }, context?)`; `selector` is optional      | Eager page rule                                      |
| `@position-try`        | `positionTry(declarations, context?)`                                    | Typed fallback reference                             |
| `@property`            | `property(definition)` or descriptors on `variable()`                    | Eager registration; `variable` references and `.set` |
| `@scope`               | `'@scope …'` in valid style/grouping bodies                              | Scoped rules                                         |
| `@starting-style`      | `'@starting-style'` in valid style/grouping bodies                       | Starting declarations or selectors                   |
| `@supports`            | `'@supports …'` in style bodies                                          | Nested declarations or selectors                     |
| `@view-transition`     | `viewTransition(descriptors, context?)`                                  | Eager stylesheet effect                              |

The coverage inventory follows [MDN's at-rule reference](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules), including descriptors, nested page-margin rules, font-feature blocks, and statement/block forms. Experimental and legacy rules remain explicit inventory entries. Compiler support and browser availability are separate claims.

Import options `layer`, `media`, and `supports` are optional; `url` is required. Font feature values require both `families` and `features`. Page rules require `descriptors`; `selector` is optional. Namespace declarations require `uri`; `prefix` is optional. Descriptor helpers and `keyframes` accept nested at-rule keys for enclosing groups and an optional trailing `{ id }` for explicit identity. Statement helpers and `layers` remain top-level.

## Declarations

Descriptor keys use camelCase. CSS string values retain required quoting. Bodies have rule-specific types: `navigation` belongs to `viewTransition`, page margin boxes belong to `page`, and `positionTry` accepts only declarations permitted by that rule.

```ts
import {
  fontFace,
  fontFeatureValues,
  importCss,
  page,
  viewTransition,
} from 'zyzz/web'

importCss({ layer: 'reset', url: './reset.css' })
importCss({ media: 'print', url: './print.css' })

fontFace({
  fontFamily: '"Inter"',
  fontFeatureSettings: '"cv11"',
  fontVariationSettings: '"wght" 450',
  src: 'url("./inter.woff2")',
})

fontFeatureValues({
  families: '"Example Font"',
  features: {
    '@styleset': { editorial: [1, 3] },
    '@swash': { decorative: 2 },
  },
})

page({
  descriptors: {
    size: 'A4',
    margin: '2cm',
    '@bottom-center': { content: 'counter(page)' },
  },
})

page({ descriptors: { marginTop: '4cm' }, selector: ':first' })
viewTransition({ navigation: 'auto' })
```

Repeated calls preserve distinct rules and authored order. The optional page selector supports named pages and page pseudo-classes; omission targets all pages. Font feature values retain their special nested block grammar.

## Named References

Reusable named definitions return domain-specific references. The compiler assigns stable package/module/binding names and preserves them through aliases, imports, re-exports, packed libraries, and rebuilds. Definitions do not require handwritten CSS names.

```ts
import { counterStyle, fontPaletteValues, positionTry } from 'zyzz/web'

export const circled = counterStyle({
  system: 'fixed',
  symbols: '"①" "②" "③"',
  suffix: '" "',
})

export const brandPalette = fontPaletteValues({
  fontFamily: '"Brand Icons"',
  basePalette: 0,
  overrideColors: '0 #ff5500, 1 #111111',
})

export const above = positionTry({
  positionArea: 'top',
  marginBottom: '0.5rem',
})
```

```ts
import { style } from './zyzz.config.js'
import { above, brandPalette, circled } from './stylesheets.js'

export namespace styles {
  export const icon = style({ fontPalette: brandPalette })

  export const list = style({ listStyleType: circled })

  export const tooltip = style({
    position: 'absolute',
    positionTryFallbacks: above,
  })
}
```

References retain their domains: a palette reference cannot become an animation name. Typed consumption also needs coverage in lists, shorthands, templates, cross-definition references, and CSS function arguments. External/global-name overrides require explicit ownership and collision semantics before exposing an option.

## Nested Rules

Grouping remains available in `style`, `variants`, compound variants, and global selector maps wherever CSS permits that context. Scope roots/limits retain native nesting and specificity semantics.

```ts
import { style } from './zyzz.config.js'

export namespace styles {
  export const card = style({
    '@scope (&) to (.boundary)': {
      '& h2': { color: 'red' },
    },
    '@container scroll-state(stuck: top)': {
      boxShadow: '0 2px 8px #0002',
    },
    '@starting-style': { opacity: 0 },
  })
}
```

Scroll-state conditions require a separately configured query container; they query an eligible ancestor. Complete query grammar includes named, unnamed, combined, negated, size, style, and scroll-state forms.

Keyframes also gain named timeline-range stops while preserving existing stops and authored order:

```ts
import { keyframes } from 'zyzz/web'

export const reveal = keyframes({
  'entry 0%': { opacity: 0 },
  'entry 100%': { opacity: 1 },
})
```

## Open Contracts

These decisions precede implementation of the affected helper. They do not defer any rule out of the full-support goal.

- **Contexts:** define one ordered mechanism for conditional/layered helper declarations, anonymous layers, nesting, repeated blocks, and legal rule placement. Keep descriptors in dedicated functions. Do not introduce an application-executing callback DSL or runtime registration.
- **CSS functions:** specify parameters, defaults, return domains, local custom properties, permitted nested rules, and typed invocation. Calls create CSS expressions; the browser evaluates the CSS function.
- **Query and profile references:** define how `customMedia` enters query keys and `colorProfile` enters `color()` without losing reference identity.
- **External names:** define explicit names, counter fallback/extension references, font-feature aliases, named pages, and collisions across packages.
- **Statements:** define import supports/layer/media options, anonymous import layers, relative asset ownership, and default namespace emission. Preserve namespace meaning across combined source modules; never hoist across a semantic boundary merely to produce valid syntax.
- **Encoding and legacy rules:** define the UTF-8 output/charset policy and explicit `@document` compatibility syntax. No ambient encoding or browser-dependent compiler behavior.

## Compilation and Evidence

All helpers are static authoring operations. Calls compile away; no stylesheet generation, registration, or authoring validation is added to runtime `style`/`variants` applications. Use static types for authoring constraints and source diagnostics for extraction, ordering, identity, and unsupported target semantics.

Eager effects survive JavaScript tree shaking. Named definitions follow reachability with exported and externally observable names handled explicitly. Preserve declaration and rule order, URL ownership, source maps, HMR replacement/deletion, and packed-library metadata.

Full support requires independent type, extraction, emission, map, packaging, and applicable browser fixtures for every inventory entry. Track unavailable browser features explicitly; accepted strings or emitted snapshots cannot substitute for rendering evidence. Web-only operations retain explicit native-target diagnostics.

## Compilation Contexts

Descriptor helpers accept nested `@layer`, `@media`, `@supports`, and `@container` keys around complete definitions. Outer keys emit outer groups. Only contexts legal for the emitted rule are accepted. Flat definitions emit at stylesheet scope. Each conditional branch must contain a complete definition. Selectors and descriptor blocks are separate contexts.

Branches of one `cssFunction` call must declare the same parameter names, syntaxes, defaults, and return syntax. Function bodies can vary between groups.

```ts
fontFace({
  '@layer fonts': {
    '@supports font-tech(variations)': {
      fontFamily: 'Body',
      src: 'url("./body.woff2")',
    },
  },
})
```

Named helpers derive stable identities from the source module and constant binding. An optional `{ id }` argument provides explicit identity. Exported identities retain their definitions across source and packed-library imports. Declaration helpers preserve authored descriptor order. Arrays preserve fallback order where the descriptor grammar permits fallbacks.

Statement helpers emit at stylesheet scope. Imports precede namespaces and ordinary rules; charset is a UTF-8 output policy, never a nested contribution. Namespace declarations have stylesheet scope and require isolation from unrelated modules. Unsupported namespace combinations must fail compilation instead of changing selectors silently.

`namespace` prefixes accept CSS identifier spellings, including Unicode and escapes. Equivalent spellings share a binding, and the last declaration applies throughout its module. Omitting `prefix` creates a default namespace; an empty `uri` selects elements with no namespace. URI strings are identities and are never fetched as assets.

CSS functions use ordered parameter records with `name`, optional `syntax`, and optional `default` fields, an optional `returns` syntax, and a `body` containing `result`, local custom properties, and conditional groups. Custom media owns a query identity; profile identities belong inside CSS color expressions. Compiler support does not establish browser or print-engine support; see the target-specific limits below.

## Conformance Evidence

`pnpm check:at-rules` verifies the pinned MDN inventory, supplementary modern rules, descriptor fingerprints, and referenced evidence files. `pnpm check:at-rules:full` requires all compiler obligations and executes type/integration evidence. Target compatibility and rendered evidence have separate gates; `check:at-rules:legacy-full` retains the previous combined requirement. Inventory coverage alone does not establish type, compiler, packaging, or browser support. Browser limitations remain explicit in the acceptance report.

> [!NOTE]
> `colorProfile` is exported with descriptor validation and domain-specific references. Print-engine compatibility and rendering evidence are tracked separately.

## Output Encoding

Generated stylesheet files use UTF-8 without a BOM or `@charset`. Source maps and packed sections remain Unicode text; imported CSS assets retain their authored bytes. Serve generated CSS with UTF-8 transport metadata. No nested charset helper or alternative output encoding is exposed.

`colorProfile` preserves `src`, `renderingIntent`, and comma-separated `components`, and links names inside `color(${profile} …)` across source and packed imports. WeasyPrint 70.0 verifies basic ICC painting. Relative profile colors and rendering-intent evidence remain open for rendering targets.

## Function Signatures

`cssFunction` accepts single syntax components, `+`/`#` repetition, and `type(...)` alternatives. Scalar alternatives retain argument and result domains through packed libraries. List arguments use CSS text with compiler grammar validation; commas are enclosed in an argument block during source and runtime expression formatting. Repeated return types cannot flow into bounded shorthands. Comma-list results require a destination with explicit list metadata; custom properties accept unbounded output. Space-separated transform-function results are accepted by `transform`; custom properties retain arbitrary repeated domains.

```ts
const size = cssFunction({
  parameters: [
    { name: '--size', syntax: 'type(<length> | <percentage>)', default: '25%' },
  ],
  returns: 'type(<length> | <percentage>)',
  body: { result: 'calc(var(--size) * 2)' },
})
```

Unicode and escaped syntax identifiers, static list arguments, nested function references, defaults, and media/supports/container bodies are validated in source and packed contracts. Extended identifier signatures publish contract version 12. The new PDF fixture verifies named pages, first/left selectors, counters, and sixteen margin boxes against native CSS; WeasyPrint adds bleed geometry and printer-mark evidence. Complete fragmentation behavior remains open.

## Native Registrations

`property` emits an eager registration with an authored custom-property name. Syntax supports the Properties and Values API component types, alternatives, and `+`/`#` multipliers. Non-universal registrations require a computationally independent initial value. `variable()` retains its scalar reference and assignment contracts.

```ts
import { property } from 'zyzz/web'

property({
  name: '--spacing',
  syntax: '<length>+ | auto',
  inherits: false,
  initialValue: '4px 8px',
})
property({ name: '--payload', syntax: '*', inherits: true })
```

Nested `@layer defaults` and `@media screen` keys enclose the registration. Registration changes CSS computed-value behavior; it does not evaluate values in JavaScript. Compiler diagnostics reject invalid syntax, mismatched initial values, computational dependencies, and injected declarations.

Page `bleed` accepts relative lengths and dimensional calculations. Page `size` accepts one or two lengths or calculations, as well as named paper sizes and orientation. Percentages and dimensionally incompatible calculations are rejected.
