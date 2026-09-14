# Architecture and API

## Status and boundaries

Main `9aa72fc` includes Phase 1 and PRs 2.1/2.2a: 40-property literal validation, in-memory CSS emission, literal source extraction/rewriting, file hosts, scalar theme contracts/scopes, and token-name resolution. Bound `theme.css` has type inference but still requires theme-aware source linking. The [parity audit](parity.md) distinguishes implemented behavior from the remaining API targets. The MVP prioritizes web correctness and includes a working native subset.

The core owns typed ordered declarations, token resolution, validation, and deterministic identity. It has no filesystem, browser, device, parser, framework, or build-tool dependencies. Source adapters extract definitions; target emitters generate artifacts; host adapters deliver them.

Use small modules and subpath exports. All compilation paths share core semantics. Frameworks consume ordinary props objects containing web classes/bindings or native styles, without required providers, wrappers, or environment detection.

## Entry Points

`css` and `variants` from `zyzz` author standard CSS with an empty token contract. The root entrypoint neither imports nor re-exports bundled themes or their token data. Importing a theme does not alter the root function or register global state.

Bundled themes use independent `zyzz/themes/<name>` entrypoints. The MVP provides `zyzz/themes/default` with named exports:

| Export     | Contract                                                             |
| ---------- | -------------------------------------------------------------------- |
| `css`      | The bound `theme.css` function with the theme's inferred tokens      |
| `variants` | The bound `theme.variants` function with the same inferred tokens    |
| `theme`    | The full theme for variants, scopes, extension, and target compilers |
| `tokens`   | Raw token definitions for explicit composition with `Theme.define`   |

The default theme bundles colors, typography, spacing, radii, and related design scales. Light and dark are color schemes within the theme. Additional themes follow the same entrypoint contract; consuming one theme must not include another theme's data or CSS.

The exported `css` and `variants` alias `theme.css` and `theme.variants`, with identical inference, token identities, and output. `tokens` contains authored definitions; `theme.tokens` contains portable token references. Source adapters recognize these bindings through package exports and re-exports without executing theme modules.

Platform APIs are named namespace exports from dedicated entrypoints:

```ts
import { Css } from 'zyzz/web'
import { StyleSheet } from 'zyzz/react-native'
```

`fontFace`, `global`, `keyframes`, and `layers` are direct named exports from `zyzz/web`. `Css` remains the named namespace for pure web compilation; stylesheet functions are not members of that namespace. `StyleSheet` owns React Native compilation and precompiled theme/scheme selection. Both target compilers consume shared `Style.define` data through pure in-memory APIs. The root entrypoint remains independent of these target namespaces and their platform adapters.

Consumer concepts, usage, and API status are documented in [docs](../docs/README.md).

## Configuration and Inferred Authoring

Accepted API: retain `Theme.define`/`Theme.extend` for reusable token definitions and add `Config.create` as the usual authoring entrypoint, exported as a namespace from `zyzz`.

Export `const { css, variants, theme } = Config.create(...)` from `zyzz.config.ts`. Consumers import `{ css, variants, theme }` directly. Integrations follow these named exports without requiring a default export.

The config is an ordinary importable, statically analyzed module, not an executable configuration hook or a required filename. The root core remains pure and independent of source discovery and platform adapters.

```ts
// zyzz.config.ts
import { Config } from 'zyzz'

export const { css, script, theme, variants } = Config.create({
  layers: ['reset', 'base', 'components'],
  theme: {
    color: { brand: { dark: '#8cf', light: '#06c' } },
    spacing: { md: '1rem' },
  },
})
```

`theme` accepts inline token definitions or an existing `Theme.define`/`Theme.extend` value. Named `themes` accepts a mixture of those inputs. `theme` and `themes` are mutually exclusive; omitting both produces token-free bound functions. In named mode, require `defaultTheme`, inferred from the catalog's keys, rather than choosing by object order. Single-theme mode returns `theme`; named mode returns the default `theme` for shared token references and a callable `themes` selector. Both return `css` and `variants`; no returned layer-reference object is required.

```ts
import { Config, Theme } from 'zyzz'

const base = Theme.define({
  color: { brand: { dark: '#8cf', light: '#06c' } },
})

export const { css, script, themes, variants } = Config.create({
  defaultTheme: 'base',
  layers: ['reset', 'base', 'components'],
  themes: {
    base,
    mint: { color: { brand: { dark: '#9fc', light: '#175' } } },
  },
})
```

The default determines token paths/domains and unscoped fallback values. Named alternatives must satisfy the complete shared contract; reject missing/extra paths or incompatible domains. Inline alternatives provide full tokens; `Theme.extend(base, overrides)` supplies partial changes through its resolved complete definition. Normalize returned theme handles onto a stable shared configuration contract without mutating standalone definitions or merging their existing identities globally. Config-bound styles and the returned handles participate in this contract; matching names on independently compiled definitions alone do not establish interchangeability. Preserve the contract across imports, aliases, re-exports, and packed libraries.

`layers` is an ordered readonly tuple of valid CSS layer names. Infer exact `@layer <name>` keys directly in the returned `css` and every supported style body of `variants`, retaining property/value/token inference at every depth:

```ts
import { css } from './zyzz.config.js'

namespace styles {
  export const button = css({
    '@layer components': {
      backgroundColor: 'brand',
      ':hover': { opacity: 0.8 },
    },
  })
}
```

Autocomplete declared keys and reject misspellings such as `@layer component`. No computed key, layer-reference import, or unrestricted string index signature is needed. Preserve declaration order in `layers` as cascade order. An omitted layer list contributes no named layer keys to config-bound functions. Additional project layer declarations do not ambiently widen an imported function's type; include every layer used by that function in its config. Raw unbound web authoring remains subject to its own syntax/extraction contract.

Apply a callable theme to `<html>` for document-wide scope and color-scheme selection:

```tsx
import { themes } from './zyzz.config.js'

const selected: Parameters<typeof themes>[0]['theme'] = 'mint'
const example = (
  <html {...themes({ theme: selected, colorScheme: 'dark' })}>
    <head>
      <title>My App</title>
    </head>
    <body>
      <button {...styles.button()}>Save</button>
    </body>
  </html>
)
```

Scope classes assign live custom properties; descendants inherit values without changing their component classes or copying a theme's token set into inline styles. Nested scopes select themes independently. `colorScheme: 'light'` or `'dark'` forces a scheme; `'light dark'` follows browser preference through `light-dark()` color leaves. Themes and schemes remain separate axes. Dynamic per-instance values retain the existing callback binding API. Native selects precompiled theme/scheme tables through its adapter; it does not interpret web scope classes or layers.

Globals and additional layer contributions retain project-wide collection and may be colocated outside `zyzz.config.ts`. Config declarations contribute their layer order through that same pipeline. The filename convention never changes inference in direct root imports or requires runtime providers. Public config properties remain explicit and narrowly typed; new settings need their own semantics rather than an arbitrary metadata bag.

The named config helpers retain the config's complete inferred contract. Source adapters must follow `css`, `variants`, and theme handles through aliases, re-exports, and package boundaries. CSS references use `theme.vars`.

Integrations discover the originating config through that binding without requiring a default export. No config import performs compilation at runtime.

## Theme definition

`Theme.define(tokens)` accepts only token definitions. No name, identifier, contract metadata, or scheme container is required.

```ts
import { Theme } from 'zyzz'

export const theme = Theme.define({
  color: {
    brand: '#0066cc',
    muted: { light: '#666666', dark: '#999999' },
  },
  backgroundColor: {
    surface: { light: '#ffffff', dark: '#111111' },
  },
  textColor: {
    primary: { light: '#171717', dark: '#ededed' },
  },
  borderColor: {
    subtle: { light: '#dddddd', dark: '#333333' },
  },
  spacing: { sm: '0.5rem', md: '1rem' },
  borderRadius: { md: '0.5rem' },
})
```

Each color leaf has the type `string | { light: string; dark: string }`. A string applies to both schemes. A pair requires both values; partial pairs and unknown scheme keys are errors. Nested palette keys are supported, for example `color.blue.500`, consumed as `'blue.500'`.

Token names infer from literal definitions. A scheme pair is a leaf, never a palette namespace. Ambiguous paths, including literal keys containing the path separator, are rejected.

| Token group       | Properties receiving its keys                                         |
| ----------------- | --------------------------------------------------------------------- |
| `color`           | All supported color-valued properties                                 |
| `backgroundColor` | `backgroundColor`                                                     |
| `textColor`       | CSS `color`                                                           |
| `borderColor`     | Border color shorthand and physical/logical border color properties   |
| `spacing`         | Supported spacing and sizing properties                               |
| `borderRadius`    | Border radius shorthand and corner properties                         |
| `typography`      | Optional typed typography presets expanded into ordinary declarations |

Property-specific color groups augment the shared `color` group and win when a key exists in both. A `textColor.primary` token is available to `color: 'primary'`, but not `backgroundColor: 'primary'`. `textColor` is a token category; authored styles keep the standard CSS property `color`.

`Theme.define` uses exactly the supplied token groups, with no implicit preset merge. Bundled definitions are available as `tokens` from `zyzz/themes/default`; object spreads can opt into its groups. Token values must be statically resolvable and valid for their target.

## Property Mappings

`Config.create({ shorthands })` defines optional authoring aliases. Each key maps to a nonempty readonly tuple of supported standard properties. No aliases are installed by default; root `css` and independently defined themes retain standard property names.

```ts
import { Config } from 'zyzz'

export const { css, script, theme, variants } = Config.create({
  shorthands: {
    px: ['paddingLeft', 'paddingRight'],
    paddingX: ['paddingLeft', 'paddingRight'],
    paddingHorizontal: ['paddingLeft', 'paddingRight'],
  },
  theme: {
    spacing: { sm: '0.5rem' },
    margin: { sm: '0.75rem', gutter: '2rem' },
    padding: { sm: '1rem' },
    textColor: { primary: '#111' },
  },
})

namespace styles {
  export const card = css({ px: 'sm', margin: 'gutter', color: 'primary' })
}
```

All three aliases expand to physical left/right padding. Logical alternatives can target `paddingInlineStart` and `paddingInlineEnd`. Aliases never change meaning implicitly with the output target.

Expand each alias in place, preserving authored declaration order and target tuple order. Resolve tokens and validate values against each target property after expansion. Alias values must be valid for every target; only token names available to every target are inferred, with each target resolving its own value.

Standard declarations and aliases follow the same cascade rules after expansion. For `{ px: 'sm', paddingLeft: '2rem' }`, the later left declaration wins at equal importance. Preserve fallback arrays, importance, conditions, dynamic bindings, and composition conflict domains through normalization; do not sort aliases ahead of standard properties.

Reject empty/duplicate targets, unknown properties, alias-to-alias references, and alias names colliding with standard properties, selectors, queries, or reserved authoring keys. Mappings contain static data only, with no callbacks or runtime registration. A config owns its aliases; named theme switches cannot change them.

Apply the same contract to config-bound `css`, theme handles, and `variants`. Preserve exact key/value inference inside nested rules without a broad string index. Source extraction, imported configs, packed metadata, and watch invalidation must retain mappings without evaluating application code. Native validates expanded properties against its supported subset.

### Property-Specific Tokens

`margin` and `padding` are optional token groups covering their shorthand, physical, and logical properties. They augment `spacing`; matching keys in the specific group win. Either group can be supplied without `spacing`. Margin tokens accept supported signed lengths; padding tokens require nonnegative lengths. CSS keywords such as `auto` remain literal declarations.

In the example, `px: 'sm'` resolves through `padding.sm`, while `marginLeft: 'sm'` resolves through `margin.sm`. Margin-only keys are unavailable to padding or sizing. `textColor.primary` applies to CSS `color`; shared `color` is optional. Styling with a `textColor` property requires an explicit `textColor: ['color']` shorthand.

Retain group identity in token references, variables, liveness, extension validation, and named theme compatibility. Explicit references select their original group rather than being redirected by implicit precedence. Additional arbitrary token categories need their own domain contract; shorthand configuration alone does not create token groups.

## Consuming Styles

Every `css` definition returns a callable. Calling it returns plain props to spread onto a component. Static styles use `button()`; dynamic styles use `button(values)`. There is no direct class-string or props-object overload for consuming an uncalled definition.

```tsx
import { css } from 'zyzz'

namespace styles {
  export const button = css({ color: '#06c', padding: '1rem' })
}

export function Button() {
  return <button {...styles.button({ className: 'checkout' })}>Continue</button>
}
```

Theme-bound and bundled functions follow the same contract, with inferred tokens:

```tsx
import { css } from 'zyzz/themes/default'

namespace styles {
  export const button = css({ padding: 4, color: 'blue.700' })
}
const element = <button {...styles.button()} />
```

`Theme.define` returns bound `css` and `variants`, portable `tokens`, web variable references through `vars`, and a scope `className`. Destructuring, aliases, and re-exports retain inference. Static and dynamic definitions may be inline, module-level, exported, or imported. Extraction recognizes the authoring binding independently of markup position.

```tsx
const { css, variants } = theme

export namespace styles {
  export const button = css({
    backgroundColor: 'surface',
    color: 'primary',
    borderColor: 'subtle',
    padding: 'md',
    borderRadius: 'md',
    ':hover': { backgroundColor: 'brand' },
  })
}

const element = <button {...styles.button()}>Continue</button>
```

Inline usage is also valid: `<button {...css({ padding: '1rem' })()} />`. Extraction replaces definitions with small props-binding functions and can fold fully static applications into constants. No runtime style generation occurs. Untransformed authoring calls fail with an actionable missing-transform diagnostic.

Token names autocomplete in their matching properties. CSS literals and keywords remain available; explicit `theme.tokens` references select tokens whose names collide with CSS values. `Style.define` remains the pure in-memory API for named definitions; low-level `Css.compile` still returns stylesheet text and class maps independently of the component authoring interface.

The in-memory equivalent is `Style.define({ card: { color: 'brand', padding: 'md' } }, { theme })`. It resolves property-compatible names into the same portable references as explicit `theme.tokens` values before CSS emission. Literal syntax and CSS zero take precedence over token names. Property-specific color groups take precedence over shared colors only at matching leaf paths. Bound authoring types and this pure resolution boundary precede source linking; `theme.css` still throws without the corresponding transform.

## Value Syntax

Importance uses a trailing `!` on a string. Fallbacks use a nonempty array of values, in declaration order. CSS expressions are ordinary strings or template literals. There is no helper context or helper callback.

```ts
namespace styles {
  export const panel = theme.css({
    display: ['block', 'grid'],
    color: 'brand!',
    backgroundColor: 'oklch(60% 0.2 250)',
    borderColor: theme.vars.color.brand,
    width: `calc(100% - ${theme.vars.spacing.md})`,
  })
}
```

Parse a single final, unescaped `!` outside CSS strings, comments, and functions as declaration importance, before resolving a token or literal. Also accept standard trailing `!important`. Quoted content such as `content: '"Hello!"'` retains its punctuation. Reject malformed or repeated markers. An important numeric value uses a CSS string, for example `opacity: '0.5!'`; nonzero numeric spacing tokens retain their ordinary token rules.

Each fallback array entry is a separate declaration. Later supported entries win subject to ordinary CSS importance; `['block!', 'grid']` retains the important first declaration. Empty/nested arrays are errors. Comma-separated CSS lists remain strings, for example `fontFamily: 'Inter, sans-serif'`. Do not reorder or deduplicate away meaningful fallback sequences. Native rejects unsupported fallback/importance semantics rather than silently dropping them.

The compiler only interprets importance and fallback structure visible in source. Runtime strings cannot inject importance or new declarations. A statically authored suffix such as `${values.width}!` may mark a supported dynamic scalar binding important; passing `'50%!'` as a runtime value does not change rule priority. Dynamic fallback groups remain outside the initial supported subset.

`theme.tokens` supplies portable references with property domains. `theme.vars` supplies a readonly inferred tree of web CSS `var()` references for scalar declaration tokens, with the defining value as fallback. Template interpolation retains reference identity and liveness. Theme references can be imported or destructured without executing theme modules; root imports have no implicit theme or token data.

`theme.vars.spacing.md` follows inherited theme overrides. Color-pair values use `light-dark()` under the ordinary color-scheme contract. Query thresholds, container names, and composite typography presets are excluded from `theme.vars`; queries resolve to literal conditions. Native accepts portable `theme.tokens` and rejects web-only `theme.vars` references.

Root `css` accepts literal lengths, valid unitless numbers, and CSS zero. Named tokens and nonzero numeric spacing tokens require a theme. CSS literal/keyword precedence resolves ambiguous names; explicit token references select the token instead. Arbitrary CSS expressions use literal strings and receive compiler syntax validation; they do not implicitly interpolate token names.

TypeScript checks token/reference paths and direct property domains, including fallback entries and important suffixes. Full CSS grammar validation belongs to the compiler for static expressions and to the browser for arbitrary runtime strings.

Applied web props contain a readonly `className` and optional `style`, plus validated recipe data attributes when applicable. The `className` field may retain an optional `ClassName<Properties>` brand for restricted component contracts; this describes a field, never the return type of the definition itself. Metadata is not enumerable component output.

## Attributes and composition

Prefer platform state attributes and custom data attributes over conditional class concatenation:

```tsx
namespace styles {
  export const button = theme.css({
    ':disabled': { opacity: 0.5 },
    '&[aria-expanded="true"]': { backgroundColor: 'brand' },
    '&[data-loading="true"]': { cursor: 'progress' },
  })
}

const example = (
  <button
    {...styles.button()}
    disabled={disabled}
    aria-expanded={expanded}
    data-loading={loading}
  />
)
```

Native/ARIA attributes must reflect actual behavior and accessibility semantics. Visual variants use data attributes. A data attribute alone does not disable a control or supply accessibility state.

`cx(base(), override())` is the explicit composition API, with later arguments winning for conflicting generated declarations in the same selector/condition context. It accepts generated props objects and conditional false/null/undefined entries and returns one spreadable props object. Combine classes with the generated conflict metadata, merge owned custom-property bindings, and preserve recipe data attributes. For repeated variable keys, later bindings win; conflicting recipe attribute ownership remains an error. An external class can be supplied explicitly as `{ className: external }`, without a last-wins guarantee for its CSS. Static compositions compile away; dynamic compositions use an optional resolver over compiler-produced metadata and precompiled rules, never a CSS generator.

Plain concatenation retains CSS cascade semantics. External `className` fields pass through `cx` without a last-wins guarantee. Do not pass bare class strings or uncalled style definitions to `cx`. Multiple JSX spreads perform ordinary property replacement and are not style composition; use `<button {...cx(base(), override())} />` to preserve both classes and bindings. Matching condition contexts compose; different overlapping conditions retain their declared CSS precedence. Importance still follows CSS semantics. Define shorthand/longhand partial overrides, fallback groups, logical/physical interactions, and conditional cancellation in fixtures before claiming reliable composition.

A props object containing a class string does not itself supply conflict metadata. Keep compiler metadata outside enumerable DOM props; never spread internal metadata onto components. The implementation gate must prove how imported generated classes carry or explicitly supply metadata to the transformed resolver across package boundaries, without a global registry. If required metadata is unavailable, emit a diagnostic rather than silently concatenate with a false guarantee. Static atom normalization must make partial overrides possible without generating new runtime rules.

## Dynamic Styles and Styling Overrides

An expression-bodied callback receives only the runtime values record. An annotated parameter defines the input contract; the callback returns an object with static property/selector/condition structure. `css` always returns a callable, regardless of whether its definition is an object or callback.

```tsx
import { css } from 'zyzz'

namespace styles {
  export const track = css({ height: '0.5rem' })

  export const bar = css((values: { width: `${number}%` }) => ({
    width: values.width,
  }))
}

export function Progress() {
  return (
    <div {...styles.track()}>
      <div {...styles.bar({ width: '50%', className: 'progress' })} />
    </div>
  )
}
```

Static applications accept optional styling overrides. Dynamic applications combine required runtime values with `className`, `style`, and `variables` overrides in one input. Consumed values never become component props. The callback sees only its declared values. Event handlers, children, refs, accessibility state, and other component props stay on the component.

```tsx
type PanelValues = { readonly width: `${number}px`; readonly opacity: number }

namespace styles {
  export const panel = theme.css((values: PanelValues) => ({
    width: values.width,
    opacity: values.opacity,
    color: theme.vars.color.brand,
    padding: 'md',
    ':hover': { opacity: values.opacity },
  }))
}

const element = (
  <section
    {...styles.panel({
      width: '320px',
      opacity: 0.8,
      className: 'checkout',
      style: { marginTop: '1rem' },
    })}
  />
)
```

Web overrides accept `className`, `style`, and `variables`; native overrides use the target's `style` shape. Variant data attributes derive from selection keys and cannot be supplied directly as overrides. Reject unknown input keys in consumer types and untyped calls. Never forward arbitrary props, merge handlers, or mutate input objects.

Reserve `className`, `class`, `style`, `variables`, `key`, and `ref` from runtime-value and variant names. Values may otherwise overlap component attribute names, but their declared keys are consumed; the component receives such attributes separately. Resolve the complete finite value-key set from the annotated input contract, including unused fields; do not strip only fields observed in the callback. Reject index signatures, unresolved key sets, and ambiguous contracts before emission. Library declarations and precompiled binding metadata preserve that key set.

### Merge Rules

- **Classes.** Keep generated classes and append a supplied external `className`. External CSS follows the cascade; its position in the class string cannot guarantee an override. Generated-style last-wins composition uses `cx` and compiler metadata.
- **Inline Styles.** Merge generated variable assignments first and caller `style` second. Caller inline properties follow browser cascade semantics, including importance. Compiler-owned variable keys are private and cannot be assigned by caller overrides; use the declared runtime values instead. Preserve public custom properties such as explicit variable assignments.
- **Variant Attributes.** Derive owned data attributes exclusively from validated selections. Change the selection key to override a choice. Keep unrelated attributes and all other component props outside the styling call.
- **Composition.** `cx(base(), dynamic(values), variants(selection))` returns styling props with the same class/style merge rules. Reject unrelated props. It preserves required variable bindings, rejects conflicting recipe attribute ownership, and never invokes or chains handlers. Repeated JSX spreads only replace fields and are not the style composition API.

For static definitions, `button()` can compile to constant props. A surviving imported callable needs only the props merge path. For dynamic definitions the compiler emits all CSS ahead of time and lowers value reads to fixed binding slots; the generated callable consumes input fields, assigns variables, and merges styling overrides. The original authoring callback never runs in the application. Values changing across calls retain the same classes and rule count.

The MVP supports required string/finite-number fields, direct record reads, and supported template interpolation into scalar declarations. No optional/null input leaves, runtime selectors/queries, dynamic object shape, computed reads, spreads, branches, or arbitrary calls inside definitions. Calculations happen at the call site or in supported CSS expressions. Runtime inputs are literal CSS values, never implicit token keys or numeric spacing tokens; use `variants` for finite token choices.

Source adapters resolve typed contracts and binding syntax before type erasure without executing application code. The pure core consumes ordered declarations and target-independent slots, shared with `variable`. Untyped application calls validate required consumed fields and primitive shape; unknown keys are rejected as invalid styling inputs. Compiler diagnostics cover unsupported definitions and property domains.

React web output uses `className`/`style` props; Vue maps these at the class/style adapter boundary. Native output uses a native `style` prop, with caller overrides after generated styles and explicit unit conversion. Native does not parse CSS or emulate importance/fallbacks. `StyleSheet.select` remains static lookup. No provider, global registry, DOM mutation, or runtime stylesheet generation is introduced.

Integration gates cover static and dynamic calls, repeated updates, nested instances, pseudo/query values, theme inheritance, server/hydration parity, packed consumers, consumed-key removal, reserved-key errors, and styling override merging and unrelated-prop rejection. Verify private variables cannot inherit stale values, handlers stay on components, no metadata leaks into DOM props, and rule counts stay fixed. Consumer fixtures prove callable inference and strict override inputs. Benchmark static calls, dynamic binding, prop merging, emitted bytes, and browser recalculation separately.

## Typed runtime variables

```tsx
import { variable, css } from 'zyzz'

const progress = { amount: variable('percentage') }
namespace styles {
  export const bar = css({ width: progress.amount })
}

const example = (
  <div {...styles.bar({ variables: { [progress.amount]: `${percent}%` } })} />
)
```

Dynamic callbacks are the concise path for values local to one styles. Keep `variable` for explicit shared variable contracts and independent assignments. Both forms use the same compiler binding model.

`variable()` declares an unconstrained variable; `variable(kind, options)` declares a typed variable reference and compiles to fixed web bindings. The initial schema supports `number`, `length`, `percentage`, and `color`, with target validation. `reference.set(value)` returns ordinary inline custom-property assignments on web; unknown keys or incompatible values are type errors. Unassigned variables follow normal CSS behavior unless the authored rule specifies a fallback.

Dynamic assignment is allowed; dynamic rule generation is not. The core never reads device/browser state. Native adapters bind values to preidentified supported properties with explicit conversions; they do not parse CSS. Unsupported variable types or expressions fail compilation. This binding path is distinct from `StyleSheet.select`, which preserves static lookup identity.

## Variants

`theme.variants(definition)` binds recipe definitions to the theme, just like `theme.css`. The direct `variants` export from `zyzz` has an empty token contract. Bundled theme entrypoints also export the bound function. No variant namespace or explicit theme argument is needed.

Each recipe styles one element and returns one spreadable props object when applied. Multipart components use separate `css` or `variants` definitions for their elements. Shared selections use ordinary component inputs; DOM relationships use data attributes or typed markers. Recipes have no `slots` option or map of part props.

```tsx
namespace styles {
  export const button = theme.variants({
    base: { display: 'inline-flex' },
    variants: {
      intent: {
        primary: { backgroundColor: 'brand' },
        ghost: { backgroundColor: 'transparent' },
      },
      size: {
        sm: { padding: 'sm' },
        md: { padding: 'md' },
      },
      loading: {
        true: { opacity: 0.5 },
        false: {},
      },
    },
    compoundVariants: [
      {
        when: { intent: 'primary', size: ['sm', 'md'] },
        style: { fontWeight: 600 },
      },
    ],
    defaultVariants: { intent: 'primary', size: 'md', loading: false },
  })
}

type ButtonVariants = NonNullable<Parameters<typeof styles.button>[0]>
const element = (
  <button {...styles.button({ intent: 'ghost', size: 'sm', loading })} />
)
```

`variants` and `theme.variants` take static recipe objects. Use `theme.tokens` and `theme.vars` for explicit references; no context callback is needed. Infer variant names, string values, booleans, defaults, compound keys, and style tokens. `NonNullable<Parameters<typeof button>[0]>` extracts selection props; callers can make selected properties required using ordinary type utilities. The selection argument is optional, so `button()` applies defaults. No custom props helper is required.

```ts
import { variants } from 'zyzz'

namespace styles {
  export const button = variants({
    variants: { size: { sm: { padding: '0.5rem' }, md: { padding: '1rem' } } },
    defaultVariants: { size: 'md' },
  })
}
```

Destructured `theme.variants`, imported aliases, and re-exports preserve inference and extraction. Recipe structure remains static; individual choices may be value callbacks as specified below. The selection input accepts only declared variant axes and styling overrides under the same merge rules as `css`. Reject reserved axis names and conflicting owned data attributes.

The web callable returns a stable recipe `className` and normalized attributes such as `data-intent="ghost"`, `data-size="sm"`, and `data-loading="true"`. Defaults are materialized in the output. Omitted/undefined selections use defaults; null suppresses that variant and its default, omitting its attribute. False serializes as `"false"`. Static types reject invalid selections and unknown input keys, including inputs held in variables. Runtime callables perform no validation; untyped callers must validate external data before selection.

Compile rules as `.button-k3m9:where([data-intent="ghost"])`, scoped to the recipe identity. Variant names must map unambiguously to valid data-attribute names; reject collisions after normalization. One recipe owns each emitted attribute on an element; combining recipes with conflicting attribute ownership needs explicit future composition support.

Precedence is base, then variant axes in declaration order, then matching compounds in array order, for otherwise matching contexts and importance. Compound arrays mean any listed value for that axis; different axes combine with AND. Compound rules apply styles and do not prohibit other combinations. Attribute selectors use zero added specificity so compilation controls recipe precedence.

Static calls compile to constants. Dynamic calls resolve selections/defaults, serialize attributes, bind active choice values, and merge styling overrides. No new classes or rules are generated. Avoid generating the Cartesian product of web variants: emit axis rules and authored compound rules. Keep optional `cx` overrides separate; recipe conditional rules must participate in the same documented conflict contract if composed.

The native target consumes the same recipe definition and selection types, emitting static alternatives with matching defaults and precedence. Its adapter returns platform styles without DOM attributes. Measure combination growth; deduplicate shared declarations and use precompiled ordered references where supported instead of generating CSS or unbounded tables. Browser-only selectors in a shared recipe produce target errors.

### Dynamic Variant Choices

Each choice accepts a static style object or a typed value callback. The callback follows the dynamic `css` contract and compiles to the same binding slots; runtime values remain local to that axis and choice.

```tsx
namespace styles {
  export const button = theme.variants({
    base: { display: 'inline-flex' },
    variants: {
      size: {
        sm: { padding: 'sm' },
        md: { padding: 'md' },
        custom: (values: { padding: `${number}px` }) => ({
          padding: values.padding,
        }),
      },
    },
    defaultVariants: { size: 'md' },
    compoundVariants: [
      { when: { size: 'custom' }, style: { fontWeight: 600 } },
    ],
  })
}

const element = (
  <button
    {...styles.button({
      size: { custom: { padding: '12px' } },
      className,
      style,
    })}
    disabled={disabled}
    onClick={onClick}
  />
)
```

Static choices use their ordinary string/boolean selection. Dynamic choices require a single-key object, such as `{ custom: { padding: '12px' } }`. Its key selects the choice; its payload must exactly satisfy that callback's values contract. Reject bare dynamic names, empty/multiple-choice objects, unknown choices, missing/extra fields, wrong domains, and payloads attached to static choices. Input types preserve this discriminated union through `Parameters`, theme aliases, and packed declarations.

Defaults use the same selection shape. A dynamic default supplies a complete statically resolvable payload; a bare dynamic choice name is invalid. Omitted/undefined axes use the default; null suppresses the axis, its attribute, and its bindings. Boolean static choices keep their existing semantics. An object key for a dynamic boolean choice uses its normalized string name.

The output for the example includes the stable recipe class, `data-size="custom"`, and inline assignments for the selected choice's generated variables. Never serialize payloads into data attributes. Variables are scoped by recipe, axis, choice, and binding identity, so two choices may both name a field `padding` without sharing assignments. Switching choices emits a fresh complete assignment object containing only active bindings; real renderer tests must prove obsolete assignments are removed.

Compound conditions match normalized choice names, independently of payload values. `when: { size: 'custom' }` matches every valid custom padding; array matches retain their existing semantics. MVP base and compound style bodies remain static. Choice callback declarations may use supported pseudo/query conditions with fixed structure, just like dynamic `css`.

The scalar `padding` example expands to four longhand bindings sharing one value, preserving partial overrides through `cx`. Reject unsupported shorthand bindings rather than guess how to split runtime CSS. Keep importance and fallback restrictions identical to dynamic `css`.

Native binds active choice values to supported preidentified properties with explicit unit conversions and the same selection/default/compound behavior. Web-only semantics produce errors. Continuous payload values never create a Cartesian product or additional stylesheet rules.

Integration coverage must include real source compilation and rendering, active-to-static/null/default transitions, stale-variable cleanup, same-named payload fields on separate axes, compounds, theme/scheme changes, styling overrides, nested instances, and packed consumers. Consumer fixtures verify every rejected shape and inferred payload. Benchmark selection plus binding, emitted CSS/JavaScript, and native selection without rule or table growth per runtime value.

## Selectors and conditional rules

Style objects accept standard CSS properties, scoped selectors, and conditional at-rules. Nested declarations retain the same property types and theme-token inference at every depth.

```ts
namespace styles {
  export const control = theme.css({
    display: 'inline-flex',
    color: 'primary',
    ':hover': { backgroundColor: 'brand' },
    ':focus-visible': { outlineStyle: 'solid' },
    ':disabled': { opacity: 0.5 },
    '&::before': { content: '"→"' },
    '& > svg': { width: '1em' },
    '&[aria-expanded="true"]': { backgroundColor: 'brand' },
    '@media (width >= 48rem)': {
      padding: 'md',
      ':hover': { color: 'brand' },
    },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
    '@container (width >= 30rem)': { flexDirection: 'row' },
    '@supports (display: grid)': { display: 'grid' },
  })
}
```

`&` refers to the current scoped selector. A leading pseudo-class or pseudo-element inserts `&`, so `:hover` means `&:hover`. Descendant, child, attribute, and compound selectors use explicit `&`. Nested selectors and conditions preserve their authored order, specificity, and conjunction; flattening must not change these semantics.

CSS property names and value types follow standard CSS, augmented by domain-specific tokens. Selector and raw condition strings remain flexible and receive compiler syntax validation; TypeScript does not prove that arbitrary selector/query text is valid. Do not add a general string index signature that hides misspelled properties.

The initial conditional syntax supports `@media`, `@container`, and `@supports`. Config-bound style objects infer `@layer <name>` keys from their declared layers; standalone layer contributions use the collection API below. Other at-rules require explicit capability support and diagnostics. Stylesheet-level rules use the optional `Css` APIs below, outside element declaration objects.

## Relational Selector DX

This is the planned selector API, not implemented source syntax. Use standard pseudos and explicit `&` relationships; retain token inference inside every nested declaration block. Named data attributes identify application-owned groups and peers. The accepted typed ref design below adds inferred relationships without replacing raw CSS selectors.

```tsx
import { css } from 'zyzz'

namespace styles {
  export const indicator = css({
    opacity: 0,
    ':where([data-group="profile"]:has(a)) &': { opacity: 1 },
  })
}

const profile = (
  <article data-group="profile">
    <a href="/profile">Profile</a>
    <span {...styles.indicator()}>Has a link</span>
  </article>
)
```

This inspects descendants of the marked ancestor. `:has(a)` alone would inspect descendants of the styled element. No parent-state JavaScript, wrapper component, generated ref class, or class concatenation is required.

| Relationship                             | Authored Selector                                     |
| ---------------------------------------- | ----------------------------------------------------- |
| Current control state                    | `:checked`, `:focus-visible`, `&[data-state="open"]`  |
| Current element contains a checked child | `:has(> input:checked)`                               |
| Named ancestor state                     | `:where([data-group="profile"]:hover) &`              |
| Earlier peer is checked                  | `:where([data-peer="choice"]:checked) ~ &`            |
| Later peer is checked                    | `&:has(~ [data-peer="choice"]:checked)`               |
| Earlier peer contains a checked input    | `:where([data-peer="choice"]:has(input:checked)) ~ &` |
| Direct children / all descendants        | `& > *` / `& *`                                       |
| A generated pseudo-element               | `::before` with explicit `content`                    |

The compiler preserves normal selector matching and specificity. `:where(...)` explicitly lowers the surrounding condition's specificity; no implicit rewrite does so. Peer combinators retain direction. Repeated nested group names match any qualifying ancestor, not only the nearest one; distinct names separate roles. Selector strings cannot prove DOM structure or attribute existence through TypeScript.

Offer completion for supported pseudos and condition forms without an unrestricted object-key index signature. Parse compound/relative selectors, `:has`, `:is`, `:not`, `:where`, nth formulas, and lists with a real CSS parser; preserve conjunction and authored order through nesting. Invalid syntax and unsupported target capabilities receive source diagnostics.

Literal `:hover` remains ordinary CSS. Use `@media (hover: hover)` explicitly for pointer-capable hover effects. Do not insert pseudo-element content or a reset automatically. Reusable imported immutable condition objects and spreads use the ordinary static-expression contract, not an additional variant-registration API.

Browser fixtures must exercise real input/focus/pointer changes, DOM insertion/removal, nested named groups, and combined queries. Native rejects relational selectors until a separately specified adapter can preserve their meaning.

### Style References

`selectors` objects interpolate `css()` definitions without calling them. `&` selects the styled element; combinators, pseudo-classes, attributes, and `:has()` retain ordinary CSS semantics. Apply the referenced definition through its normal style props. An empty `css()` supplies identity without declarations.

```ts
import { css } from 'zyzz'

namespace styles {
  export const card = css()
  export const label = css({
    selectors: {
      [`${card}:hover &`]: { color: 'blue' },
      [`${card}[data-state="open"] > &`]: { opacity: 1 },
      [`${card} > &:nth-child(even)`]: { opacity: 0.5 },
    },
  })
}
```

References retain their identity through local aliases, namespace members, named imports/re-exports, and packed libraries. Selector grammar is checked during compilation. The compiler checks interpolation identities; TypeScript checks nested declaration values; it does not validate selector text or prove DOM structure.

Specificity follows the authored selector. Use explicit `:where(...)` to lower condition specificity. Application-owned state remains in ordinary data/ARIA attributes. No runtime selector parsing, DOM lookup, or CSS generation is involved.

## Inferred query thresholds

Themes can define dedicated size thresholds separately from spacing and general sizing tokens:

```tsx
const { css } = Theme.define({
  spacing: { sm: '0.5rem', md: '1rem' },
  breakpoints: { tablet: '48rem', desktop: '64rem' },
  containers: { card: '24rem', panel: '40rem' },
})

export namespace styles {
  export const layout = css({
    padding: 'sm',
    '@media tablet': {
      padding: 'md',
      ':hover': { opacity: 0.9 },
    },
    '@container card': { display: 'grid' },
  })

  export const region = css({ containerType: 'inline-size' })
}
const example = (
  <section {...styles.region()}>
    <div {...styles.layout()} />
  </section>
)
```

| Theme group   | Inferred key      | Emitted rule                  |
| ------------- | ----------------- | ----------------------------- |
| `breakpoints` | `@media tablet`   | `@media (width >= 48rem)`     |
| `containers`  | `@container card` | `@container (width >= 24rem)` |

Alias keys autocomplete from the corresponding theme group and reject unknown names. `@media card` does not use `containers.card`, and `spacing.md` is not a query threshold. Nested conditions retain both alias inference and declaration inference. A theme without a threshold group offers no aliases for that group.

Threshold names are flat identifiers. Values are finite, nonnegative CSS lengths expressed as strings, such as `48rem` or `768px`; the compiler validates supported length units. Unitless numbers, percentages, runtime custom properties, and light/dark pairs are rejected. Keep standard unit semantics; do not convert relative thresholds to pixels implicitly.

Alias keys are exact shorthand forms. Raw media queries use explicit condition syntax, for example `@media (width >= 48rem)` or `@media screen and (width >= 48rem)`. Bare `all`, `screen`, and `print` remain reserved standard media types and cannot be breakpoint names. Reject unknown bare aliases instead of treating them as arbitrary query text.

`card` in `@container card` names a threshold, not a CSS container. The emitted unnamed query selects the nearest eligible ancestor for the queried feature. Applications establish size containment using standard `containerType`; a container cannot size-query itself. Named containers also support raw syntax such as `@container sidebar (width >= 24rem)` with an ancestor's `containerName: 'sidebar'`.

Thresholds resolve to literal conditions at compile time, never to CSS custom properties. Changing a theme scope or color scheme cannot alter existing query thresholds. `Theme.extend` may override existing thresholds for styles authored through the extended theme's `css`; it does not change queries already authored through the base function. Definition edits trigger dependent recompilation.

Rule identity and deduplication include resolved conditions. Different threshold values must not share an atom solely because their aliases have the same name. Do not sort breakpoints numerically or flatten overlapping conditions in ways that change authored precedence.

These are web capabilities. Native compilation rejects unsupported selectors and queries, including threshold aliases, until an explicit target contract exists. It must not silently turn browser queries into device listeners.

Additional inferred query keys support comparisons and ranges:

| Key                         | Meaning                                                     |
| --------------------------- | ----------------------------------------------------------- |
| `@media >=tablet`           | Width at least tablet; equivalent to `@media tablet`        |
| `@media <desktop`           | Width below desktop                                         |
| `@media tablet..desktop`    | Inclusive tablet lower bound, exclusive desktop upper bound |
| `@container >=card`         | Nearest eligible container at least card width              |
| `@container sidebar >=card` | Named sidebar container at least card width                 |

`containerNames: ['sidebar', 'content']` in the theme infers names for both `containerName` declarations and named alias queries. Raw CSS names remain available through explicit literal/raw forms. Validate unknown names, malformed ranges, and reversed comparable bounds. Mixed-unit ranges retain CSS semantics; do not guess a pixel conversion or numerically sort them.

## Stylesheet APIs and layers

```ts
import { fontFace, global, keyframes } from 'zyzz/web'

const fadeIn = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
})
global({
  'html, body': { margin: 0 },
  body: { fontFamily: 'system-ui' },
})
fontFace({
  fontFamily: 'App Sans',
  src: 'url("/fonts/app.woff2") format("woff2")',
  fontWeight: '100 900',
  fontDisplay: 'swap',
})
namespace styles {
  export const animated = theme.css({
    animationName: fadeIn,
    animationDuration: '200ms',
  })
}
```

`keyframes(frames)` returns a typed animation-name reference. Accept `from`, `to`, percentages in the inclusive 0–100 range, and valid comma-separated stops. Frame values are declaration objects; reject nested selectors/queries and important declarations. Preserve source order at overlapping offsets, and never reorder frame declarations mechanically. Theme values use explicit `theme.tokens` or supported `theme.vars` references.

```ts
import { keyframes } from 'zyzz/web'

const enter = keyframes({
  from: { opacity: 0, transform: 'translateY(4px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
})
namespace styles {
  export const notice = theme.css({
    animationDuration: '160ms',
    animationName: enter,
    '@media (prefers-reduced-motion: reduce)': { animationName: 'none' },
    ':focus-visible': { outline: '2px solid currentColor' },
  })
}
```

Longhands are the simplest typed usage. When animation shorthand/templates and comma-separated animation lists land, parse them and preserve reference identity instead of concatenating unvalidated strings. Reused/imported animations emit reachable definitions with stable names; frame references survive library packaging and query wrapping. Explicit global names need collision and ownership rules before they are exposed.

Animation tests inspect paused/seeked animation progress through the real browser engine rather than sleeping. Cover theme variables, scope changes, reduced motion, malformed offsets, repeated references, and unused-definition removal. `@starting-style` is a separate ordered rule capability for entry transitions, not a keyframe alias.

These authoring calls compile away into explicit stylesheet contributions. Preserve global/font-face side effects through tree shaking; emit reachable keyframes with stable references. Pure in-memory compilation receives extracted contributions as data and never relies on module registration. Native rejects these web-only operations; fonts are loaded through platform mechanisms.

### Complete At-Rule Authoring

Accepted direction: [top-level stylesheet functions](../docs/api/web/at-rules.md). New helpers remain unimplemented until their Phase 2.5 evidence gates pass. Descriptor/statement rules use direct `zyzz/web` imports; `global` retains selectors and grouping rules.

Named helpers return domain-specific references with compiler-owned identities. Eager helpers retain stylesheet effects. Existing `fontFace`, `keyframes`, `layers`, and `variable()` gain complete grammar coverage; variable registration stays on `variable()`.

The linked contract specifies every MDN at-rule, descriptor contexts, repeated calls, page/font subrules, and examples. Conditional/layered declarations, query/profile reference consumption, external names, CSS functions, encoding, and namespace boundaries remain explicit design gates. New authoring APIs add no runtime validation or registration.

### Layer and Global Collection

Accepted API for 2.4c: `Config.create({ layers, ... })` declares semantic layer order and binds inferred `@layer <name>` keys on `css` and `variants`. `global(styles)` contributes global selector rules and supported nested at-rules anywhere at module scope. The [configuration contract](#configuration-and-inferred-authoring) replaces computed layer-reference keys in config-bound examples.

```ts
import { Config } from 'zyzz'

export const { css, script, variants } = Config.create({
  layers: ['reset', 'base', 'components', 'overrides'],
})
```

```ts
import { css } from './zyzz.config.js'

import { global } from 'zyzz/web'

global({
  '@layer base': {
    body: { fontFamily: 'system-ui', margin: 0 },
    '@media print': { body: { color: '#000' } },
  },
})

export namespace styles {
  export const button = css({
    '@layer components': { padding: '1rem' },
  })
}
```

Layer placement belongs to authored blocks in both global and scoped styles. Unwrapped rules remain unlayered; declaring `base` does not implicitly place globals there. `global` has no ambient access to a config's TypeScript catalog: raw global at-rule strings receive compiler validation. Config-bound functions reject undeclared layer keys through their explicit inferred contract.

The direct `layers` import from `zyzz/web` contributes standalone module-level order declarations; it is not required to obtain keys for config-bound authoring. Its declarations and config layer lists feed the same order constraints. Layer names follow CSS identifier and dotted-name syntax; duplicate names in one declaration receive diagnostics. Named layers intentionally share CSS identity; libraries namespace public layers such as `acme.components`. Pure compilation receives explicit extracted data independently of source discovery or a runtime registry; consumers do not configure layer placement on `Css.compile`.

The collection contract is project-wide: adapters scan configured source roots, including unimported modules, with tests, generated output, and dependencies excluded by default. Dependency contributions require explicit inclusion or published library artifacts. Declarations must be static and module-level; calls inside functions, runtime branches, or component rendering receive diagnostics. No application code executes during collection.

Collected globals are eager application-wide stylesheet effects even when declared beside lazy components or unused JavaScript exports. Preserve them independently of JavaScript tree shaking and package `sideEffects: false`; scope normal component styles through `css`. Identify contributions by stable package/module/call identity, emit repeated imports once, and retain repeated authored rules where their position affects the cascade.

Collect layer order constraints before emitting content. Merge compatible declarations with stable topological ordering; reject cycles with diagnostics pointing to the conflicting declarations. Use canonical layer names to break otherwise unconstrained ties. A shared declaration specifies intentional relative precedence. Emit dotted layer hierarchy and one order prelude in initial shared CSS before any participating layer block; preserve ordinary unlayered precedence and important reversal. Already loaded external CSS cannot have its established layer order repaired retroactively.

Within each module preserve authored rule order. Across project modules use a documented stable package/module order, independent of filesystem enumeration, parallel transform completion, and chunk arrival. Use explicit layers for intentional cross-file overrides. Hoisting and minification must not reorder conflicting rules or coalesce repeated declarations unsafely.

The CLI and build adapters feed the same contribution representation to the pure compiler. Development replaces or removes contributions by source identity after edits/deletions; it never accumulates stale globals. Preserve source maps and resolve relative asset URLs through the owning source module before relocation. The initial shared stylesheet carries global contributions and the layer prelude; scoped styles may retain their normal chunk boundaries.

Published libraries carry ordinary CSS plus contribution/layer metadata for composition. Applications own the final top-level ordering, include the prelude before library layer blocks, and detect conflicting declarations visible in the compilation graph. Plain CSS consumers load the exported stylesheet normally; native rejects globals and cascade layers explicitly.

Prior art: [vanilla-extract layer references](https://vanilla-extract.style/documentation/api/layer/) and [globalStyle](https://vanilla-extract.style/documentation/global-api/global-style/) inform typed contributions; [Astro](https://docs.astro.build/en/guides/styling/) and [Svelte](https://svelte.dev/docs/svelte/global-styles) demonstrate colocated global authoring. [Panda globals](https://panda-css.com/docs/concepts/writing-styles) and [Tailwind layers](https://tailwindcss.com/docs/adding-custom-styles) inform object declarations and standard CSS grouping. Project-wide unimported-module collection is Zyzz's explicit policy. Ordering follows the [CSS cascade specification](https://www.w3.org/TR/css-cascade-5/#layer-ordering).

The reset is opt-in via `import 'zyzz/reset.css'` and declares a reset layer. Merely importing the core changes no global styles. Test coexistence with ordinary stylesheets, global rules, and independently packaged libraries in multiple load orders. Layer ordering does not turn arbitrary class concatenation into last-wins composition.

## Theme scopes and extension

Theme-bound styles work without a root wrapper. Color and shared-token declarations reference generated custom properties with the defining theme's values as fallbacks. This permits ordinary inheritance and explicit overrides without automatically attaching a theme scope to every styled element.

```tsx
export const alternate = Theme.extend(theme, {
  color: { brand: '#147d32' },
  backgroundColor: {
    surface: { light: '#f0fff4', dark: '#081b0d' },
  },
})

const panel = (
  <section {...alternate()}>
    <button {...theme.css({ backgroundColor: 'surface', color: 'brand' })()}>
      Continue
    </button>
  </section>
)
```

`Theme.extend(theme, overrides)` accepts partial token groups and existing keys only. Each overridden color is a complete string or scheme pair. It returns the same shape as `Theme.define` and inherits its token contract. Adding tokens uses a new definition; extension cannot silently change a component's contract.

`theme.className` and `alternate.className` compile to scope constants. Each scope emits the complete resolved set of live variables for that contract, preventing outer theme values leaking through omitted overrides. The original component classes work under either scope. Scope changes do not require recompiling components.

In-memory definitions carry opaque contract references. Source adapters derive stable internal identities from package identity, package-relative module location, and declaration binding; build hosts provide this context. Absolute machine paths, traversal order, and token values must not determine contract identity. Extensions reuse their base identity.

Standalone definitions remain isolated even when their keys match. The planned Config catalog normalization described above creates a separate shared contract for returned handles without changing those standalone identities. Library output preserves contract identity in generated artifacts. Renaming a definition can change identity; changing only its values cannot. Callers never supply this metadata to `Theme.define`.

## Light and dark

Scheme pairs emit `light-dark(lightValue, darkValue)`; plain strings emit unchanged. Normal CSS selects the scheme independently of the selected theme:

```css
:root {
  color-scheme: light dark;
}
.light {
  color-scheme: light;
}
.dark {
  color-scheme: dark;
}
```

`light dark` permits the browser's preferred scheme. `light` and `dark` select one explicitly. Theme scopes do not force a scheme. Nested scheme scopes retain theme values; nested theme scopes inherit the scheme. There is no preference listener or separate “system” token value.

Browser fixtures must cover fallback values, explicit variables, nested themes, forced schemes, preference changes, and server-rendered markup. Native targets resolve each pair into two static alternatives; strings are identical in both. Device preference resolution belongs in an application adapter.

### Callable Theme Props

A theme handle is callable while retaining its metadata, token references, authoring helpers, and `className`. `theme(options = {})` returns `{ className }` or `{ className, style: { colorScheme } }` when a scheme is supplied. Accept only `'light'`, `'dark'`, and `'light dark'`; unknown options and invalid schemes are errors.

Config single themes and named catalog members share this contract. Apply the main theme to `<html>`; nested elements can select independent scopes. Retain generated class identities rather than global `data-theme` names, preserving isolation between configs and libraries. Theme application generates no rules and accesses neither DOM nor storage.

The compiler must support local/imported/packed handles and finite dynamic catalog selection, retaining application types and stable server/client identities. Untransformed calls fail with the missing-transform diagnostic. Native adaptation remains separate from this web props contract.

### Root Preference Initialization

`Config.create` returns a bound `script(options = {})` function that generates inline JavaScript. It needs no separate import. Derive the named theme catalog, compiled scope classes, and default selection from its config; the only override is `options.storageKey` (default `'zyzz'`). The server renders fallback root props. No explicit mapping API, duplicate defaults, cookies, providers, or core browser dependencies.

Source integration must recognize `script` calls on the config receiver through imports, aliases, re-exports, and packed metadata. Serialize only compiled scope identities and selection metadata, never token data or authoring functions. Single-theme and token-free configs restore the color scheme only; ignore stored theme names in those modes. Preserve server-rendered defaults when no valid stored preference exists.

The localStorage record is `{ theme?: string, colorScheme?: 'light' | 'dark' | 'light dark' }`. Read it synchronously once from a classic inline script early in `<head>`, before stylesheets and visible content. Apply allowlisted preferences to `document.documentElement`; retain unrelated classes/styles and remove only classes belonging to the supplied catalog.

Missing/malformed/inaccessible storage preserves server defaults. Validate fields independently and use own-key catalog lookup. Never evaluate saved strings or trust saved classes. Serialize script inputs safely for HTML raw-text contexts, including closing script tags and Unicode separators. Support application-provided CSP nonce attributes or exact-source hashes.

System preference uses `light dark` directly, with no listener or script required. The initializer neither writes storage nor synchronizes live state. React may suppress the expected root-attribute hydration warning; preference controls initialize from the applied DOM state before updates. Verify first-paint behavior and hydration before accepting implementation.

## Pure target compilers

```ts
import { Style } from 'zyzz'
import { Css } from 'zyzz/web'

const styles = Style.define({
  card: {
    backgroundColor: theme.tokens.backgroundColor.surface,
    padding: theme.tokens.spacing.md,
  },
})

const web = Css.compile({ styles, themes: { base: theme, alternate } })
web.css // Stylesheet string.
web.classes.card // Class-name string.
web.themes.alternate // Scope class-name string.
```

Theme map keys label outputs only; they do not define token identity or belong inside theme definitions. `Css.compile` returns `{ css, classes, themes }` and throws `Css.CompileError` with structured diagnostics. Direct in-memory calls need no parser or file access; source adapters additionally produce rewritten modules and source maps.

```ts
import { StyleSheet } from 'zyzz/react-native'

const native = StyleSheet.compile({
  styles,
  themes: { base: theme, alternate },
  units: { rem: 16 },
})
const selected = StyleSheet.select(native.styles, {
  theme: 'alternate',
  colorScheme: 'dark',
})
selected.card // Precompiled native style object.
```

`StyleSheet.compile` returns `{ styles }` indexed by supplied theme label, scheme, and style name. It throws `StyleSheet.CompileError` for unsupported semantics. `StyleSheet.select` performs an identity-preserving lookup with inferred labels and `light | dark`; invalid untyped selections throw `StyleSheet.SelectionError`.

Native styles and variants share token data and portable declarations. Web selectors and class strings are not native capabilities. Unit conversion is explicit, including `units.rem` when required; unavailable conversions and font mappings fail compilation. No runtime CSS parser or compiler is introduced. Optional variable binding and recipe selection use explicit platform adapters; static theme lookup remains unchanged.

## CLI

The CLI is a first-class compilation path alongside build integrations and in-memory APIs. It owns filesystem and watch behavior, keeping the core environment-independent.

Planned default command:

```sh
zyzz build
```

Planned watch and production commands:

```sh
# Compile authored modules and extract a stylesheet.
zyzz build

# Rebuild changed modules, styles, and imported theme dependencies.
zyzz watch

# Production output, retaining readable class names.
zyzz build --minify
```

`--out-dir` defaults to `dist` and contains transformed source, per-module CSS, maps, and packed metadata. Downstream tooling lowers TypeScript/JSX and emits declarations. Shared contributions use `zyzz.shared.css`. Modules contain generated props-binding functions in place of definitions, with fully static applications eligible for constant folding. Both reference precompiled classes; authoring callbacks do not remain in delivered code. Applications import the stylesheet or load it through a standard stylesheet link. Libraries publish these artifacts directly.

The CLI compiles source and CSS by default. `--css-only` emits CSS and CSS maps for original source, whose helpers derive stable identities and bind props without emitting rules. Identity-bearing declarations require explicit IDs. Vite provides the same opt-out through `compiler: false`.

Watch mode handles additions, edits, deletions, renames, and imported theme changes, excluding output directories. Errors include source locations. One-shot errors exit nonzero; watch remains active and preserves the last complete successful output. Interrupts release watchers and the exclusive lock; the ownership manifest and artifacts retain their recorded package identity. Owned-output manifests prevent overwriting unrelated files.

The default target is web. A later `--target native` emits static tables through the same native emitter; CSS-specific flags are invalid for that target. CLI and build adapters must produce equivalent style identities and CSS for equivalent input graphs.

## Bundler Setup

> [!NOTE]
> The named `zyzz()` adapter from `zyzz/vite` implements compilation and CSS delivery. Keep its public setup aligned with [Getting Started](../docs/introduction/getting-started.md).

The optional adapter connects the shared compiler to Vite's module graph. It rewrites authoring modules, delivers development CSS updates, and emits linked production CSS assets. Consumers retain their framework plugin and import source components normally.

- **Core:** remains independent of Vite, frameworks, filesystems, and runtime CSS generation.
- **Delivery:** plugin setup owns stylesheet loading; no manual virtual CSS import is required by the proposed guide.
- **Other bundlers:** use CLI output until a concrete adapter and public setup are defined.
- **Parity:** plugin and CLI paths must agree on identities, conditions, theme scopes, and emitted behavior for equivalent input graphs.

Application examples import authored components and the named config helpers normally. A bundler adapter hides rewriting and delivery. Standalone CLI output belongs to a downstream build or package distribution; consumers do not hand-maintain imports to generated component copies. CSS-only output cannot replace rewriting for the current callable API.

### Next.js Setup

> [!NOTE]
> The accepted public setup is `zyzz(nextConfig)` from `zyzz/next`; the adapter is not implemented. See [Next.js Setup](../docs/introduction/next.md).

```ts
import { zyzz } from 'zyzz/next'

export default zyzz({ reactStrictMode: true })
```

The wrapper configures source transformation, CSS delivery, and watching for Webpack and Turbopack internally. Application modules continue importing the named config helpers from their config. No separate Babel or PostCSS configuration is required by this public contract.

Reuse the shared compiler and keep loader/transform selection internal. Preserve existing Next.js options and compose build hooks and rules without replacing application configuration. CSS delivery and dependency invalidation require separate bundler implementations and real fixtures; do not assume Webpack hooks work under Turbopack.

Acceptance covers Server Components, client components, streaming, hydration identities, Fast Refresh, route navigation, imported config/theme edits, production CSS loading, and failure recovery. Record the verified Next.js version matrix. Async/function-valued configurations remain a separate design gate; unsupported forms must fail explicitly.

## Small CSS and readable classes

Planned next: `Config.create({ cssOutput: 'atomic' | 'grouped' })` selects web emission, defaulting to atomic. Bound styles, variants, and theme helpers inherit it; root helpers use atomic. Renderer `output` remains independent. See [CSS Output](../docs/guides/css-output.md) for the shared contract and examples.

Atomic output uses individual declaration classes, retaining ordered same-property fallback sequences where necessary. Grouped output uses scoped declaration blocks. Both preserve authored cascade semantics. No automatic size-based strategy or per-style override is planned; current emitter behavior below remains historical implementation evidence until this gate passes.

Propagate mode through source aliases, cache identities, and versioned packed contracts. Libraries retain their defining mode; mixed-mode composition must preserve bindings and precedence. CLI extraction and the optional compiler plugin share identities. CSS-only CLI operation without the plugin requires explicit IDs for identity-bearing declarations.

Readable names contain a property or documented abbreviation, a token/value label, and any condition label. Illustrative names are `p-md-k3m9`, `bg-surface-a7c2`, and `hover-bg-brand-b4d8`. A short deterministic suffix distinguishes theme contracts, values, conditions, and ordering contexts; names never consist solely of a hash.

The current literal emitter uses encoded authored names for ordered rules and sorted, compact `z_base` identifiers for shared rules. `Css.compile({ composition: 'independent', styles })` additionally deduplicates identical ordered bodies and uses compact escaped authored names. Each resulting class list is one complete application: these lists must not be concatenated with each other. Resolve composition before compilation, or retain the default `ordered` mode, which preserves A/B/A and shorthand/longhand behavior across raw class combinations. Source adapters may select independent mode only after proving that application boundary; dynamic composition requires the planned conflict resolver. These identities belong to one complete compilation graph. Source and packed-library adapters must introduce stable module/graph namespaces before supporting independently emitted stylesheets; independent bundles must not reuse these unscoped identifiers.

Use the same names in development and production. Minification compresses CSS syntax without renaming classes. Bound label length, escape valid identifiers, and check collisions with deterministic disambiguation. Do not embed source paths or require callers to write generated class strings.

Deduplication identity includes the full declaration value or variable fallback, theme contract, selector, at-rule stack, cascade layer, and any ordering constraints. Never merge identical-looking token labels from incompatible themes or change precedence through global sorting.

Conflicting shorthand/longhand declarations, overlapping logical/physical properties, and interacting conditional blocks require preserved ordering. Atomic mode uses contextual atoms or proven normalization; grouped mode may retain ordered blocks. Combining independently compiled class strings follows stylesheet cascade order; class-string order is not an override API.

Emit only reachable rules and used token variables. Explicit theme scopes retain complete values for every live contract key. Independently compiled libraries remain correct without whole-application deduplication; cross-library deduplication is an optional consumer optimization.

Measure raw and compressed CSS, generated class-string bytes, total transferred bytes, rule count, compilation time, incremental updates, and representative browser style recalculation. Measure both configured modes on repeated and mostly unique styles. Preserve the selected mode and atomic default regardless of measured size; do not change readable names or generate rules at runtime.

### Compiler and Minifier Responsibilities

Core owns typed style semantics, theme and variant lowering, composition, class references, CSS-variable bindings, and deterministic standard CSS output. Source analysis identifies reachable definitions; generated JavaScript and required runtime helpers remain the compiler's responsibility. Keep safe deduplication within the configured emission mode, but do not implement a general CSS minifier or graph-search optimizer for the MVP.

The CLI/build adapter uses Lightning CSS for final CSS minification and browser-target processing, or delegates final processing to the consuming build. Core imports do not include the minifier, browser-target databases, compression libraries, filesystem APIs, or environment detection. Standalone compilation remains usable without minification. Native emission remains separate from web post-processing.

The minifier owns value shortening, shorthand generation, compatible adjacent-rule merging, prefix handling, and syntax lowering for configured browser targets. Supply known-unused symbols when available; the minifier cannot infer application reachability from CSS alone. Keep CSS identifiers aligned with generated JavaScript and preserve readable names; minification must not silently rename classes independently of their references.

Use one final CSS processing stage. When the consumer owns minification, emit standard CSS and source maps without an additional mandatory minifier pass. When the adapter owns it, apply explicit browser targets and reproducible options, compose source maps, and preserve the same class identities across development and production. Syntax formatting may differ between these modes.

Emit compatible rules and condition blocks contiguously when their ordering is already safe. Never reorder conflicting declarations simply to enable a minifier merge. Arbitrary classes may coexist; shorthand/longhand interactions and repeated A/B/A overrides retain their semantics. Variant metadata may inform code generation, but does not justify a general selector solver.

### Measurement and Deferred Research

First establish a shared final-minification baseline across every benchmark library using the same Lightning CSS version, targets, and options. Keep required library artifacts and existing compiler workflows intact. Record pipeline differences, including unavoidable upstream minification; do not attribute source extraction or minifier time to the pure emitter. Measure raw/gzip/Brotli CSS and required JavaScript separately and as complete transfer, without double-counting class strings.

Validate final processed CSS through real browser integration scenarios against independently interpreted authored declarations. Preserve current cascade and size gates; investigate any changed results rather than weakening gates automatically when changing the minifier. Compare baseline and candidate sequentially on the same host with unchanged workloads and report losses as well as wins.

Custom conflict graphs, biclique discovery, beam search, solver experiments, equality saturation, dictionary extraction, and compression-based candidate selection are deferred research, not dependencies of source extraction or the MVP. Revisit only after a reproducible, material gap remains after standard minification and cannot be addressed with simpler code generation. Any proposal must account for added compile time, dependencies, correctness proofs, and full delivery cost. No benchmark-only pooling, fixture-specific branches, or runtime stylesheet decoder.

Research references retained for later investigation: [CSS graph refactoring](https://anthonywlin.github.io/papers/toplas19.pdf), [equality saturation](https://arxiv.org/abs/2004.03082), and [Re-Pair compression](https://arxiv.org/html/1704.08558v1). These do not establish gains for this project. [Lightning CSS minification](https://lightningcss.dev/minification.html) documents the delegated transformations and the adjacent-rule merging boundary.

## Extraction and acceptance

Source adapters recognize literals, immutable bindings, spreads, imports, theme-bound calls, and destructured aliases without executing application code. Dynamic definitions, unresolved imports, and cycles fail with diagnostics. Generated exports contain constants/artifacts and only the optional selection, binding, or composition operations actually used; no authoring closures or rule generation remain.

Build integration and consumer type coverage from scratch. No unit tests, mocks, stubs, fake timers, or replacement implementations. Exercise real public pipelines and their available stages, with real browser computed styles, filesystem/watch behavior, packed consumers, and native execution. Type fixtures import public entrypoints and run through TypeScript.

Cover per-property tokens, palette paths, complete pairs, bound aliases, extension keys, inferred queries, and invalid inputs. Integration gates cover theme inheritance, CLI recovery, native selection, deterministic names, collisions, and cascade equivalence. Include inline/exported/imported styles, containment, nested conditions, and immutable query thresholds under scope switching. See [the plan](plan.md).

Use Vite Plus/Vitest benchmarks over the same real consumer corpus, beginning with PR 1.1. Record baselines and candidate deltas for each implemented stage; browser rendering and host edit latency require real environment measurements. Keep artifact-size measurements separate from timing. Follow the reproducibility and regression rules in `AGENTS.md`.

## MVP gates

Web correctness leads the MVP; native is included, not deferred beyond it. Demonstrate shared layout, spacing, colors, typography, light/dark selection, and conditional variants on both mobile platforms. Publish explicit property/unit capabilities and fail unsupported web semantics.

Require actionable source diagnostics with valid alternatives, CSS-to-source tracing, refresh behavior, missing-transform errors, deterministic server output, and library stylesheet delivery. CLI and build adapters share options and useful defaults without a mandatory config file. Failed rebuilds preserve the previous complete output.

Verify and measure configured grouped and atomic emission on repeated and unique styles, including mixed-mode packed composition. Measure compressed CSS, JavaScript, class strings, rule counts, cold/incremental builds, browser recalculation, native table growth, and optional runtime costs separately. Do not claim globally zero runtime when composition, variable assignment, or dynamic variants are used; all CSS rules remain compiled ahead of time.

## Literal Compiler Boundary

`Css.compile({ styles })` from `zyzz/web` implements the literal subset documented in `docs/api/core/Style/literals.md`. It returns frozen `{ classes, css, themes }` artifacts, with an empty theme map. Nonconflicting declaration domains are shared; conflicting rules preserve authored cascade order. Class maps contain space-separated identifiers scoped to the complete compilation input. Identical inputs produce identical artifacts; adding definitions can change factoring. This historical literal boundary does not implement the planned configurable CSS output contract. Literal factoring is implemented early to meet the bundle-size budget.

## Static Source Extraction Boundary

`Source.extract({ moduleId, source })` from `zyzz/compiler` accepts module text and a required portable package-relative identity. It returns frozen `{ calls, styles }`, where calls contain UTF-16 start/end offsets and names matching `Style.Definition`. Feed styles directly to `Css.compile`. This boundary does not rewrite or execute modules, load application imports, discover configuration, or read source files.

The adapter uses standalone Oxc parsing and two-pass lexical binding analysis without configuration discovery or code generation. A compiler-internal ScopeTracker extension keeps function-body variables out of parameter initializer environments; parameters, function names, and enclosing lexical bindings remain visible. Both passes traverse identical scopes, including type-only subtrees, so preserved scope identities remain aligned. Its dependency is reachable only through the compiler entrypoint; root and web bundles do not import it. Direct named imports of `css`, including renamed imports, are recognized throughout TypeScript/JSX. Shadowed bindings and unrelated local functions remain untouched. Type-only references do not create styles.

Only direct object literals with explicit keys and string/number values are accepted. Object-level `as` and `satisfies` wrappers are transparent. Unary numeric signs are supported. Source-owned diagnostics reject callbacks, spreads, methods/accessors, computed/shorthand/duplicate properties, referenced definitions, imported binding reassignment, namespace authoring calls, and indirect imported references. `Source.ExtractError` contains immutable source spans; no partial artifacts are returned.

Style names combine a deterministic module-identity digest with the call offset; identical input repeats exactly, and source edits may change call identities. Call-site names are extraction metadata, not a guarantee that independently emitted stylesheets can be combined. Hosts must aggregate graphs or supply the stable stylesheet namespaces required by later library work. No absolute machine path participates in naming.

The root `css` signature accepts token-free literal properties and describes a callable returning web styling props with only className/style overrides. Untransformed definitions throw an error named `css.MissingTransformError`; the constructor is not exposed as a property of the root `css` export. The source transform implements static callables and direct no-argument application folding; extraction alone is not an executable transform.

### Literal Module Rewriting

`Transform.compile({ moduleId, source })` from `zyzz/compiler` returns `{ classes, code, css, cssMap, map }`. It operates on supplied text without filesystem access, application evaluation, or framework configuration. TypeScript/JSX lowering and final CSS processing remain host responsibilities. Both maps use the standard version-three format and include original source content.

The transform uses ordered CSS compilation. Conflicting classes already carry module identity; shared classes receive the same module namespace so independently distributed stylesheets cannot reuse local base identities. A module ID must include a stable package identity and relative path. Different source versions with the same ID replace one another rather than coexist. Hash-derived identities are deterministic, not a mathematical collision-free naming guarantee.

Direct `css({ ... })()` calls become fresh `{ className }` expressions. Definitions that escape through exports, parameters, or other expressions become `Props.create({ className })` calls from the small `zyzz/runtime` entrypoint. This runtime has no parser, compiler, theme data, stylesheet generation, or global registry. It appends external classes and copies supplied inline styles without runtime validation. Empty overrides preserve generated classes; static types reject unrelated props and invalid override shapes. Type contracts reject extra keys through variables as well as literal objects.

Import removal is conservative: retain imports with remaining references, including type queries and shadowed names. Preserve directives, hashbangs, unrelated imports, and surrounding source. Generated runtime imports use a locally unbound name. Rewriting does not fold arbitrary named-function applications or execute authoring callbacks.

JavaScript replacements map to the authored definition or direct application. CSS selectors map to their representative definition and declarations to authored property locations. Factored shared rules map to the first contributing definition; the class map retains every definition's output. Host adapters compose these maps with later transforms and choose map URLs and stylesheet loading explicitly.

### Build Host Boundary

Zyzz owns static authoring analysis, theme contracts, generated props, and source maps. Build hosts own module resolution, package exports, aliases, source loading, watching, and HMR. `Graph.compile({ imports, modules })` accepts resolved source edges; `Graph.create` caches theme analysis using source text and resolved identities.

The Vite adapter uses the application's existing Vite instance through plugin hooks. It resolves physical source with `this.resolve`, registers CSS dependencies with `addWatchFile`, and invalidates virtual stylesheets through the environment module graph.

It creates no nested development server or independent watcher. Cache state is isolated per environment.

The initial adapter collects reachable physical JavaScript/TypeScript within the Vite root. Virtual stylesheets include their reachable graph's rules and compatible scopes; shared rules can repeat before final processing.

Vite owns dynamic module loading and CSS splitting. Each lazy physical module is compiled on demand with its static theme dependencies. Dynamic authoring bindings, static cycles, raw dependency source authoring, and framework virtual sources remain unsupported. Packed theme entrypoints supply adjacent compiler metadata and are excluded from dependency optimization. Standalone graphs continue to reject dynamic source imports. The existing standalone/in-memory relative resolver remains a compatibility path, not the production package resolver.

Reuse Lightning CSS for browser compatibility transforms and minification at the build-adapter boundary, composing maps and retaining consuming-build targets. Let a consuming bundler own final CSS processing when it already does. `Host.create({ css })` processes standalone CSS with explicit Lightning CSS targets, optional minification, and composed maps. Processing defaults to enabled without minification or browser targets; `css: false` preserves intermediate output. Do not duplicate browser grammar, prefixing, or minification in Zyzz.

Prior art: [vanilla-extract's compiler](https://github.com/vanilla-extract-css/vanilla-extract/blob/master/packages/compiler/src/compiler.ts) combines its own styling semantics with Vite and vite-node. Zyzz retains static analysis rather than executing source. [Vite environments](https://vite.dev/guide/api-environment-plugins) provide resolution/invalidation boundaries; [Lightning CSS](https://lightningcss.dev/docs.html) processes the resulting CSS.

### File Host Lifecycle

Local theme source compilation now extends the literal transform. Module-level local `Theme.define`/`Theme.extend` factories are analyzed as data, direct bound calls resolve names through the pure theme/style boundary, and `.className` reads become scope constants. Theme identities derive from the stable module ID and binding, independently of values and offsets. Generated JavaScript contains no theme constructor; TypeScript preserves literal contract types. Local module-level const aliases of bound css, destructuring/renaming, and alias chains compile through lexical bindings; unsupported escaping authoring references receive diagnostics. Explicit local theme.tokens paths compile as scalar bound-style values with defining identities, fallbacks, and property-domain checks. Graph.compile links relative source imports/exports, authoring aliases, and re-exports with shared identities and cross-file maps. The file host incrementally recompiles source edits and their importers. Graph outputs versioned JSON contracts for exported themes and bound aliases. Hosts publish these beside compiled JavaScript; Vite reads the adjacent metadata after native package resolution. Contracts preserve defining identities and full scope data without runtime authoring code. Cyclic source graphs remain explicitly rejected. See [the supported boundary](../docs/guides/themes.md#compile-local-theme-source).

`Host.create({ outDir, packageId, root })` from `zyzz/node` owns filesystem state and returns `{ build, close, watch }`. The source, web, root, and runtime entrypoints have no dependency on this host.

Builds pass the complete scanned source snapshot to an owned `Graph.create` compiler. Unchanged graphs reuse results; edits re-extract changed modules and their transitive importers. Unaffected transforms are reused while theme contracts are unchanged.

Theme changes re-emit all modules to refresh compatible scopes, including those without direct imports. Source additions and removals trigger a full rebuild to recheck resolution. Failed compilation preserves the last successful cache.

The host scans JavaScript and TypeScript module extensions recursively, ignoring declaration/test/benchmark files, `.git`, `node_modules`, symbolic links, and its output subtree. It writes the source-relative module plus `.map`, `.css`, and `.css.map` sidecars. `Graph.compile` resolves static relative source imports and links supported theme declarations across modules. TypeScript/JSX lowering, package and asset import resolution, stylesheet loading, and source-map URL composition remain consumer responsibilities. Package authoring contracts, cycles, and dynamic source imports are unsupported.

An exclusive `.zyzz-lock` prevents simultaneous output owners. `close()` stops watching, drains queued builds, and releases the lock. Abrupt process termination may leave a lock requiring removal after confirming the old process has stopped. The `.zyzz.json` manifest persists artifact hashes across lifecycles. Rebuilds refuse unowned collisions and externally modified artifacts; removal only applies to unchanged owned files. Output symlinks and manifest traversal paths are rejected.

Every source must compile before publication starts. Source failures preserve the complete previous output. Each file is replaced through a temporary sibling and rename; publication failures attempt to restore applied changes. This is not a crash-atomic multi-file transaction, and concurrent external edits during publication are unsupported. One host serializes explicit builds and watch rebuilds. Empty directories may remain after their last owned file is removed.

`host.watch({ onResult })` subscribes before an initial build and reports `{ result }` or `{ error }`. Notifications coalesce while a build runs; events under the output directory are excluded. A later source edit can recover from an error without reopening the host. Callbacks must not throw. There is no process-global watcher or registration.

Portability fixtures run the same pure `Style.define` → `Css.compile` bundle in Node, a Node worker, Chromium, a browser worker, and QuickJS compiled to WebAssembly. No environment globals are injected. QuickJS provides independent embedded-engine coverage; mobile rendering and Hermes/device validation remain part of the native-target phase.

Output ownership keys follow the output filesystem's detected case sensitivity. Case-only renames retain ownership while live path aliases are rejected. Only root control paths `.zyzz.json` and `.zyzz-lock` (including their directory forms) are reserved; other `.zyzz`-prefixed source files and directories rebuild normally. The macOS host fixture verifies case-insensitive behavior on a real filesystem.

## In-Memory Theme Implementation

The first theme increment exposes `Theme.define(tokens)`, `Theme.extend(theme, overrides)`, and readonly `theme.tokens` references. Supported groups are `backgroundColor`, `borderColor`, `borderRadius`, `color`, `spacing`, and `textColor`. Values retain the existing literal color/length grammar; palettes must be nonempty, use unambiguous dot-free keys, and contain data properties. Extensions may omit groups or leaves and replace whole scheme pairs. Composite presets, query metadata, bound callables, `theme.vars`, and compiled `theme.className` arrive in subsequent increments.

`Style.define` accepts property-compatible references; root `css` remains literal-only. `Css.compile({ styles, themes })` emits readable variable names, defining fallbacks, `light-dark()` pairs, and a named scope map. Every scope resets the complete live contract, including inherited leaves. Unused tokens produce no declarations. The browser owns scheme selection through `color-scheme`; scopes never force a scheme.

In-memory contract identity is an opaque frozen object carried by references and extensions, without a global registry. The compiler assigns graph-local slots by first referenced contract. Theme-map labels only name scope classes; token values and scope-map order do not determine variable names. As with existing in-memory class output, separate graphs must not be concatenated under a shared namespace. Persistent package/module/binding identities and independently compiled theme libraries belong to the source-theme increment.

## Theme Selection and Group Expansion

Theme selection happens at two boundaries. Authoring selects a contract through `theme.css`, `theme.tokens`, or `theme.vars`; rendering selects a compatible scope through `theme.className` (currently `Css.compile(...).themes[name]`). A plain application-owned map can select scope classes without a provider, global registry, new selection API, or runtime compilation. Standalone `Theme.define` calls remain isolated; in-memory switchable themes use `Theme.extend` to share a contract.

Planned `Config.create({ defaultTheme, themes })` is an explicit normalization boundary: complete compatible inline or independently defined alternatives become returned handles on one config contract. Original definitions remain isolated and unchanged. Components must use the normalized config helpers or handles to participate in that shared contract. Color schemes remain separate CSS state.

The initial scalar groups are not the final token surface. Next groups include scalar typography (`fontFamily`, `fontSize`, `fontWeight`, `letterSpacing`, `lineHeight`), composite `typography`, and the agreed `breakpoints`/`containers` metadata. Further property-aligned scales such as `borderWidth`, `boxShadow`, `opacity`, `transitionDuration`, `transitionTimingFunction`, and `zIndex` follow the corresponding validated CSS properties. Preserve domain checking and extension compatibility for each group; do not add a permissive catch-all token namespace.

## Configurable CSS Targets

Browser compatibility belongs to optional CSS-processing adapters and consuming builds. `Css.compile` emits standard CSS without choosing browsers or importing a minifier. Browser targets are independent of the web/native rendering target.

CLI and build adapters share an optional `targets: string | readonly string[]` option using Browserslist queries. For example:

```ts
const options = {
  minify: true,
  targets: ['chrome >= 123', 'firefox >= 128', 'safari >= 17.5'],
}
```

The CLI equivalent is `zyzz build --minify --targets 'chrome >= 123, firefox >= 128, safari >= 17.5'`. The public CLI and processing adapter remain Phase 4 work. Without targets, preserve modern CSS rather than silently choosing a browser floor. A consuming build may own all final processing; thin integrations inherit its target policy unless explicitly overridden. Requesting compatibility transforms is independent of requesting minification.

Resolve query strings once at the adapter boundary into Lightning CSS targets; do not expose packed version integers as the public authoring API. Explicit options take precedence over host configuration. Include resolved targets, processing options, and processor versions in build-cache identities and diagnostic/benchmark metadata. Compose source maps after processing, and keep class references aligned.

Targets cannot silently weaken semantics. In particular, lowering `light-dark()` must preserve inherited, forced, inline, and externally authored `color-scheme` behavior. An adapter must diagnose an unsupported combination when it cannot preserve that contract; selecting an older browser is not permission to discard scheme behavior. Define browser fixtures before claiming support for each downlevel path.

Benchmark fixtures accept an explicit shared Lightning CSS target map through `Compilation.create(workload, { targets })` or `Themes.create(count, { targets })`. The immutable profile reaches every library's final processing and is recorded in result artifacts. Reproducible CI defaults stay fixed; theme profiles that lower `light-dark()` are rejected before fixture preparation. Supported custom profiles still require browser-parity validation before performance claims.

## CSS Completeness and Open Contracts

The [capability union](parity.md) consolidates the referenced frameworks into numbered capabilities, each with Zyzz usage and an implementation status. It includes the accepted typed ref/ancestor API, shared existing APIs, unresolved contracts, and explicit external-CSS examples for deferred features. Property typing, source extraction, CSS grammar, emission, browser compatibility, and native support are separate statuses. The current 40-property literal subset cannot establish general CSS parity.

The Panda cross-check covers multipart component styling, semantic token dependencies, and responsive recipe selections in union items 24–26. Multipart styling uses separate element definitions under the single-element recipe contract. Semantic token dependencies and responsive recipe selections retain their separate design gates.

Reused token constants are not live aliases. A token dependency graph requires cycles, missing references, domain checking, source identity, and override/inheritance rules without adding metadata to `Theme.define` or replacing light/dark leaves. Conditional tokens and responsive variant selections remain separate decisions; neither may reuse declaration fallback arrays or conflict with dynamic choice payloads.

Reusable typography, surface, and motion objects cover initial preset use. Rich named presets, strict token-only policy, and token documentation exports are optional follow-ups. Imported/exported recipes must retain every finite runtime-selectable alternative before static pruning; an unobserved literal choice is not necessarily dead CSS. JSX style props, component factories, runtime theme injection, and an application-local generated SDK are not core requirements.

`variable(kind, options)` accepts optional registration fields `syntax`, `inherits`, and `initialValue`, and preserves individual `.set(value)` assignment types. Static variable assignment, nested `var()` fallback chains, scoped/external variable names, and registration conflicts need explicit contracts. Do not add metadata to `Theme.define` or replace runtime callbacks with a second binding abstraction.

Renderer output also needs an explicit adapter contract: `className` plus a style object is not the same as DOM `class` plus a serialized style attribute. Keep application-time style definitions callable and spreadable; serialize at the target boundary with correct escaping and retain recipe attributes. The adapter belongs outside the agnostic core.

Full at-rule authoring is assigned to [Phase 2.5](plan.md#full-at-rule-support), using dedicated stylesheet functions and native grouping keys. Related property values and browser orchestration retain separate gates. Track grammar, identity, reachability, target constraints, and browser evidence independently; raw passthrough does not establish support.

### CLI Commands and Defaults

`zyzz build [src]` compiles once; `zyzz watch [src]` compiles immediately and rebuilds after source or dependency changes. The npm invocations are `npx zyzz build` and `npx zyzz watch`.

Both commands default to `src` input, `dist` module output, and `<out-dir>/styles.css`. Paths resolve from the working directory. Optional `--out-dir`, `--css`, `--minify`, and `--targets` flags override defaults. Minification is opt-in and unspecified targets preserve modern CSS. Token-free authoring requires no config.

Missing source directories are errors. Output directories stay excluded from discovery. Watch failures preserve the previous complete output; cleanup removes only owned artifacts. The public CLI remains an unchecked Phase 4 implementation gate.
