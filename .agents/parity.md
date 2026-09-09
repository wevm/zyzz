# CSS Capability Union

Audited 2026-09-08 against main `9aa72fc` after PR #10. This consolidates the capabilities from the [StyleX API](https://stylexjs.com/docs/api), [Tailwind reference](https://tailwindcss.com/docs/hover-focus-and-other-states), [vanilla-extract API](https://vanilla-extract.style/documentation/api/style/), and [Panda CSS docs](https://panda-css.com/docs/concepts/writing-styles). Each capability appears once, with its source equivalents and Zyzz usage. It is an API union, not exhaustive CSS standards conformance.

**Partial** means only the stated subset works today. **Planned** means an existing architecture contract awaits implementation. **Proposal** means an API shape is offered for review. **Deferred** means a later capability; external CSS examples demonstrate interoperability, not implemented Zyzz authoring support. Examples are independent unless they explicitly share a definition.

Current implementation: 211 literal properties, six scalar theme groups, portable token references, inherited in-memory scopes, and token-name resolution. Source rewriting handles direct literal root `css` calls. Bound `theme.css` has inference but still requires theme-aware source linking. Broad values, selectors, queries, stylesheet contributions, callbacks, recipes, CLI, and native output are pending.

## 01. Typed Styles and Inline Authoring

Sources: StyleX `create`/`atoms`, Tailwind utilities, vanilla-extract `style`/Sprinkles, and Panda `css`/utilities. **Partial:** literal root styles; property expansion in 2.3 and bound transforms in 2.2b.

```tsx
import { css } from 'zyzz'

export const card = css({ display: 'flex', gap: '1rem', padding: '1rem' })

const article = <article {...card()} />
const label = <span {...css({ color: '#06c' })()} />
```

Complete the property/value inventory across accessibility, backgrounds/gradients, borders/outlines, filters/masks, grid/flex, interactivity, layout/containment/positioning, logical spacing/sizing, scrolling, shadows, SVG, tables, transforms, and typography. Property spellings and token domains remain checked; broad selector support must not introduce an unrestricted object-key index signature. No separate utility-string or property-access facade is needed.

Interaction keywords support `css({ cursor: 'pointer', pointerEvents: 'auto', resize: 'inline', userSelect: 'text', visibility: 'visible' })`. Cursor image lists, SVG pointer targeting, and selection containment remain deferred.

The table subset supports `css({ borderCollapse: 'separate', borderSpacing: '8px', captionSide: 'bottom', emptyCells: 'hide', tableLayout: 'fixed' })`. Border spacing accepts a single nonnegative length or zero; paired lengths and spacing tokens remain deferred.

Panda's `strictTokens` and `strictPropertyValues` expose an additional policy choice. Zyzz keeps valid CSS literals available by default; opt-in token-only enforcement belongs in a future lint/type policy, not metadata inside `Theme.define`. Syntax validation and token-only policy are separate. Panda property shorthands and JSX style props do not require matching core APIs. [Writing styles](https://panda-css.com/docs/concepts/writing-styles)

Logical dimensions, min/max dimensions, block/inline margins and padding, and inset offsets now share the scalar token/fallback/importance pipeline. Mixed physical/logical declarations preserve order across writing modes. Shorthands accept one scalar; functional sizing values remain pending.

```ts
css({ inlineSize: '20rem', paddingInline: '1rem', marginBlockEnd: '8px' })
```

Flex basis, integer order, item/line alignment, and overflow axes now use the same type/source/emission pipeline. Multi-value shorthands remain deferred.

Physical/logical border sides and corner radii, plus outline color/style/width/offset, now share scalar token/fallback/importance handling. Border-specific colors precede shared colors; outline colors use the shared group. Combined border/outline strings and elliptical radius pairs remain pending.

Intrinsic dimension keywords, auto minimums, unbounded maximums, and content flex basis now retain literal precedence and fallback importance. Function-valued sizing remains pending.

Scroll margins/padding and scroll/overscroll behavior now support scalar declarations, fallback importance, and conflict-safe physical/logical ordering. Scroll padding accepts spacing tokens; scroll margins require literal lengths. Multi-value shorthands remain pending.

```ts
css({
  scrollPaddingBlockStart: '4rem',
  scrollBehavior: 'smooth',
  overscrollBehavior: 'contain',
})
```

Scroll snap type/alignment/stop support finite keyword combinations, ordered fallbacks, and importance. Axis strictness and paired block/inline alignment are validated without accepting arbitrary CSS strings.

```ts
css({
  scrollSnapType: 'x mandatory',
  scrollSnapAlign: 'start',
  scrollSnapStop: 'always',
})
```

Text flow now includes wrapping, hyphenation, letter/word spacing, indentation, last-line alignment, transformation, and overflow through bounded scalar values. Indentation supports spacing tokens; other typography scales and composite presets remain pending.

```ts
css({ letterSpacing: '-.02em', overflowWrap: 'anywhere', textIndent: '1em' })
```

## 02. Composition and Restricted Style Contracts

Sources: StyleX `props` and style restriction types; utility composition; vanilla-extract composition; Panda `css`/`mergeCss`/`cx`. **Planned:** conflict-aware `cx` and property restrictions in Phase 3; literal callable styling overrides already exist.

```tsx
import { css, cx } from 'zyzz'

const base = css({ color: '#06c', padding: '1rem' })
const compact = css({ padding: '0.5rem' })

const button = <button {...cx(base(), compact())}>Continue</button>
const checkout = (
  <button {...base({ className: 'checkout', style: { marginTop: '1rem' } })} />
)
```

Later generated declarations win in the same condition context, subject to CSS importance. External classes retain cascade semantics. Preserve bindings and recipe attributes, partial shorthand overrides, and packed metadata. `Parameters<typeof base>` describes application inputs. StyleX `StyleXStyles`, `StyleXStylesWithout`, and `StaticStyles` map to public style restrictions; property-restricted `ClassName<Properties>` remains a separate gate, including exclusions and static-only assignability.

## 03. Values, Expressions, Importance, and Fallbacks

Sources: StyleX `firstThatWorks`/`defineConsts`, Tailwind arbitrary values/functions/importance, vanilla-extract fallback values/CSS Utils, and Panda values/token references/importance. **Partial:** ordered fallbacks, importance, and standard length units; expressions and variables remain in 2.3.

```ts
import { css } from 'zyzz'

// Static constants and template expressions remain planned.
const gap = '1rem'
const panel = css({
  color: '#06c!',
  display: ['block', 'grid'],
  width: `calc(100% - ${gap})`,
})
```

Arrays emit ordered declarations; later supported values win under CSS importance. CSS lists remain strings. Static imported constants, literal math/color functions, and supported template interpolation use ordinary analysis. `theme.vars` works inside CSS expressions. Configured arbitrary function execution, including a clone of StyleX `env.*`, is outside core; import explicit constants instead. Dynamic inputs cannot inject selectors, declarations, or importance.

## 04. Themes, Tokens, Scopes, and Schemes

Sources: StyleX `defineVars`/`createTheme`, Tailwind `@theme`/dark mode, vanilla-extract themes/contracts, and Panda tokens/semantic tokens/themes. **Partial:** in-memory scalar contracts; 2.2b source identities and 2.4a bundled themes/query metadata.

```tsx
import { Theme } from 'zyzz'

const theme = Theme.define({
  color: { brand: { dark: '#69f', light: '#06c' } },
  spacing: { md: '1rem', sm: '0.5rem' },
})
const alternate = Theme.extend(theme, { color: { brand: '#147d32' } })
const button = theme.css({ color: 'brand', padding: 'md' })

const example = (
  <section className={alternate.className} style={{ colorScheme: 'dark' }}>
    <button {...button()}>Continue</button>
  </section>
)
```

`backgroundColor`, `borderColor`, and `textColor` augment shared colors only in matching properties. Portable `theme.tokens` references disambiguate token names from literals. CSS variables implement inheritance; scopes select compatible theme values independently of `color-scheme`. Independent definitions remain isolated. StyleX `Theme`/`VarGroup` contracts map to inferred theme/reference types; cross-package assignability remains an acceptance gate.

```ts
const inset = theme.css({
  backgroundColor: `color-mix(in oklab, ${theme.vars.color.brand} 50%, transparent)`,
  borderColor: theme.tokens.color.brand,
  width: `calc(100% - ${theme.vars.spacing.md})`,
})
```

This reuses the preceding theme; `theme.vars` and expression support remain 2.3 work.

```tsx
import { css } from 'zyzz/themes/default'

const button = <button {...css({ color: 'blue.700', padding: 4 })()} />
```

Bundled themes are opt-in entrypoints. Root `css` stays token-free. Contract-only and external-name interoperability is tracked separately in item 19.

**Config API accepted; implementation pending in 2.2c:** `Config.create({ theme })` accepts inline or reusable definitions. Named `{ defaultTheme, themes }` catalogs allow mixed inputs, validate one complete token contract, and return normalized scope handles with bound `css`/`variants`. Recommend `export const zyzz = Config.create(...)` in `zyzz.config.ts` and named `{ zyzz }` imports; neither the filename nor importing a config changes root-function inference globally.

```tsx
export const zyzz = Config.create({
  defaultTheme: 'base',
  themes: { base: theme, green: alternate },
})

const control = zyzz.css({ color: 'brand' })
const selected = (
  <section
    className={zyzz.themes.green.className}
    style={{ colorScheme: 'light dark' }}
  >
    <button {...control()}>Continue</button>
  </section>
)
```

The scopes assign inherited CSS variables, while color scheme selection is independent. Standalone theme identities stay isolated; configuration normalization is explicit. See the [configuration contract](architecture.md#configuration-and-inferred-authoring) for defaults, compatibility, inferred layers, and native boundaries.

## 05. Shared Variables and Variable Fallbacks

Sources: StyleX variables, vanilla-extract `createVar`/`assignVars`/`fallbackVar`/Dynamic, CSS custom-property usage in Tailwind. **Planned:** 2.3.

```tsx
import { css, Vars } from 'zyzz'

const progress = Vars.define({ amount: 'percentage' })
const bar = css({ width: progress.amount })

const element = (
  <div {...bar({ style: Vars.set(progress, { amount: '42%' }) })} />
)
```

Explicit sets are for shared contracts; callbacks in item 07 handle local values. Static custom-property assignments also need typed declaration support. A nested variable fallback is distinct from a declaration fallback array:

```ts
const text = css({ color: 'var(--app-accent, var(--app-brand, #06c))' })
```

The literal example references application-owned names. Generated reference fallback construction and assignment under nested conditions need a documented API before implementation; do not expose private names or accidentally nest a complete `var()` reference as the first `var()` argument.

## 06. Registered Custom Properties

Sources: [StyleX `types.*`](https://stylexjs.com/docs/api/javascript/types) and [vanilla-extract variable descriptors](https://vanilla-extract.style/documentation/api/create-var/). **Proposal required:** optional registration descriptors on `Vars.define` in 2.3. TypeScript value types alone do not register CSS properties.

Until that shape is decided, the interoperability target is an ordinary external stylesheet plus a Zyzz declaration:

```css
@property --app-progress {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}
```

```ts
const progress = css({ opacity: 'var(--app-progress)' })
```

Specify descriptor grammar, computationally independent initial values, inheritance, interpolation, duplicate ownership, and native errors. Preserve `Theme.define(tokens)` and the existing callback binding API.

## 07. Dynamic Values

Sources: StyleX dynamic styles/atoms, vanilla-extract Dynamic, Tailwind utilities referencing runtime variables. **Planned:** 2.3 bindings, using fixed compiled rules.

```tsx
const bar = css((values: { width: `${number}%` }) => ({
  width: values.width,
}))

const element = <div {...bar({ width: '42%' })} />
```

Callbacks receive only typed inputs and disappear from delivered code. Applications bind values to precompiled slots; rule counts remain fixed. Styling overrides are allowed, while arbitrary component props stay on the component.

## 08. Recipes, Defaults, and Compound Variants

Sources: StyleX variant patterns, Tailwind state-driven utility combinations, vanilla-extract `styleVariants`/Recipes, and Panda `cva`/`defineRecipe`. **Planned:** Phase 3.

```tsx
import { variants } from 'zyzz'

const button = variants({
  base: { display: 'inline-flex' },
  compoundVariants: [
    { style: { fontWeight: 600 }, when: { intent: 'primary', size: 'sm' } },
  ],
  defaultVariants: { intent: 'primary', size: 'sm' },
  variants: {
    intent: { ghost: { color: 'inherit' }, primary: { color: '#06c' } },
    size: { md: { padding: '1rem' }, sm: { padding: '0.5rem' } },
  },
})

type ButtonProps = NonNullable<Parameters<typeof button>[0]>

const element = <button {...button({ intent: 'ghost' })} />
```

Theme-bound `theme.variants` infers tokens. Include boolean choices, array compound matches, omitted/default/null semantics, and declaration-order precedence. Runtime selections produce classes and owned data attributes, without expanding every Cartesian combination.

## 09. Dynamic Variant Choices

Sources: dynamic style/recipe composition across the libraries. **Planned:** Phase 3; an additional Zyzz convenience, not a claim of identical APIs in each source.

```tsx
const button = variants({
  variants: {
    size: {
      custom: (values: { padding: `${number}px` }) => ({
        padding: values.padding,
      }),
      sm: { padding: '0.5rem' },
    },
  },
})

const element = (
  <button {...button({ size: { custom: { padding: '12px' } } })} />
)
```

Selections infer their payloads. Compounds match the choice name, not its continuous values. Switching choices removes stale bindings; payloads never become data attributes.

## 10. Pseudos, Attributes, and Child Selectors

Sources: all four libraries' selector/state systems. **Planned:** 2.4b.

```ts
const field = css({
  ':disabled': { opacity: 0.5 },
  ':focus-visible': { outline: '2px solid currentColor' },
  '::placeholder': { color: '#666' },
  '&[aria-invalid="true"]': { borderColor: '#c00' },
  '&[data-state="open"]': { display: 'block' },
})
const list = css({ '& > *:nth-child(2n)': { backgroundColor: '#eee' } })
const badge = css({ '::before': { content: '"New"' } })
```

Cover interactive/form/structural states, ARIA/data/direction, open/popover/inert, negation, and all supported pseudo-elements, including selection, marker, file selector, first letter/line, and backdrop. `& > *` selects direct children; `& *` selects descendants. Retain CSS specificity and explicit pseudo-element content. Raw selectors remain available with compiler grammar validation; types cannot prove DOM structure.

## 11. Typed Ancestors, Groups, Peers, and Descendants

Sources: [StyleX contextual selectors](https://stylexjs.com/docs/api/javascript/when), [Tailwind groups/peers and group descendants](https://tailwindcss.com/docs/hover-focus-and-other-states#styling-based-on-the-descendants-of-a-group), vanilla-extract selector composition, and Panda group/peer conditions. **Planned (API accepted):** `Css.marker` and relational selector functions in 2.4b.

```tsx
import { css } from 'zyzz'
import { Css } from 'zyzz/web'

const card = Css.marker({ state: ['closed', 'open'] })
const title = css({
  color: '#666',
  [Css.ancestor(card, ':hover')]: { color: '#06c' },
  [Css.ancestor(card, { data: { state: 'open' } })]: { fontWeight: 600 },
})

const profile = (
  <article {...card({ state: 'open' })}>
    <h2 {...title()}>Profile</h2>
  </article>
)
```

The schema infers data keys and allowed values in both marker application and conditions. Simple pseudos autocomplete. Unknown keys, values, and pseudo typos are errors. Marker calls return only private data attributes; separate styling spreads do not overwrite them. These attributes express visual state and do not replace real ARIA or control attributes.

```ts
const indicator = css({
  opacity: 0,
  [Css.ancestor(card, { has: 'a' })]: { opacity: 1 },
})
const choice = Css.marker()
const hint = css({
  [Css.siblingBefore(choice, ':checked')]: { color: '#06c' },
})
const section = css({
  [Css.descendant(choice, ':checked')]: { borderColor: '#06c' },
})
```

Place `choice()` on the real checkbox. `siblingBefore` means the marked sibling precedes the styled element; `siblingAfter` reverses that direction, and `anySibling` covers either. `has: 'a'` checks descendants of the marked ancestor, not the styled element. Combined `data`, `pseudo`, and `has` conditions match the same marked element with AND. Full contracts and lowering are in [architecture](architecture.md#typed-markers-and-ancestors).

Imported marker identity survives packaging. Helpers use explicitly documented zero-specificity relation conditions; raw selectors preserve authored specificity. Repeated instances of one marker retain normal any-matching-ancestor semantics, not an implicit nearest boundary. No runtime DOM lookup or CSS generation occurs.

## 12. Media, Container, and Feature Conditions

Sources: all four libraries' responsive/conditional styles and vanilla-extract `createContainer`. **Planned:** query metadata in 2.4a, nested rules in 2.4b.

```ts
const theme = Theme.define({
  breakpoints: { desktop: '64rem', tablet: '48rem' },
  containerNames: ['sidebar'],
  containers: { card: '24rem' },
  spacing: { md: '1rem', sm: '0.5rem' },
})
const region = theme.css({
  containerName: 'sidebar',
  containerType: 'inline-size',
})
const content = theme.css({
  padding: 'sm',
  '@container sidebar >=card': { display: 'grid' },
  '@media tablet..desktop': { padding: 'md' },
  '@supports (display: grid)': { display: 'grid' },
})
```

Apply `region()` to an ancestor and `content()` to its child. Aliases infer from the correct theme groups and resolve to literal conditions, never CSS variables. Named-container private identities across packages remain a design gate. Containers select the nearest eligible ancestor, independently of marker ancestor semantics.

```ts
const link = css({
  '@media (hover: hover)': { ':hover': { textDecorationLine: 'underline' } },
  '@media (prefers-reduced-motion: reduce)': { transitionDuration: '0s' },
  '@media print': { color: '#000' },
})
```

Also cover contrast/forced colors, pointer capability, orientation, scripting, and combined/nested conditions. Raw `:hover` does not silently add a capability query. Container style/scroll-state queries remain deferred in item 22.

## 13. Reusable Conditions and Static Extension

Sources: Tailwind `@utility`/`@apply`/`@variant`/`@custom-variant`, StyleX imported constants, vanilla-extract static style composition, and Panda `css.raw`/patterns/style presets/custom conditions. **Planned:** static expressions in 2.3 and conditions in 2.4b.

```ts
export const focusRing = {
  ':focus-visible': { outline: '2px solid currentColor' },
} as const

const button = css({ ...focusRing, padding: '1rem' })
```

Imported immutable objects and explicit composition cover reuse without a registration API. Ordinary object spreads have JavaScript replacement semantics; they do not deep-merge duplicate nested keys. Arbitrary helper execution is not part of static analysis. A duplicate utility/plugin/configuration language is outside scope.

Panda's [patterns](https://panda-css.com/docs/concepts/patterns), [text styles](https://panda-css.com/docs/theming/text-styles), [layer styles](https://panda-css.com/docs/theming/layer-styles), and [animation styles](https://panda-css.com/docs/theming/animation-styles) add reusable declaration groups. Zyzz can start with imported typed static objects and explicit CSS; composite typography is already planned. Named border/shadow/animation preset contracts remain design work. Layer styles are visual presets, not cascade layers.

```ts
const surface = {
  borderColor: '#ddd',
  borderRadius: '0.5rem',
  borderWidth: '1px',
} as const
const stack = css({
  ...surface,
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
})
```

Panda property-based conditions and responsive arrays map to nested Zyzz blocks in item 12. Zyzz arrays remain declaration fallbacks, so they must never double as breakpoint positions. Reusable condition lists must specify AND versus OR and preserve order; no underscore-condition registry is needed. [Conditional styles](https://panda-css.com/docs/concepts/conditional-styles)

## 14. Keyframes, Animation, and Entry Transitions

Sources: StyleX `keyframes`, Tailwind animation/starting styles, vanilla-extract `keyframes`, and Panda keyframes/animation styles. **Planned:** 2.4c keyframes and 2.4b `@starting-style`.

```ts
import { keyframes } from 'zyzz/web'

const enter = keyframes({
  from: { opacity: 0, transform: 'translateY(4px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
})
const notice = css({
  animationDuration: '160ms',
  animationName: enter,
  '@media (prefers-reduced-motion: reduce)': { animationName: 'none' },
})
const entry = css({
  opacity: 1,
  transition: 'opacity 160ms',
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  '@starting-style': { opacity: 0 },
})
```

Validate offsets, ordered overlapping frames, theme references, and animation shorthand/lists; reject important frame declarations. Preserve imported references and remove unused animations. Discrete entry/exit transitions additionally require explicit `transition-behavior` and relevant properties. Test actual browser animation progress and motion preferences.

## 15. Font Faces and Assets

Sources: vanilla-extract `fontFace`/`globalFontFace`, font authoring through ordinary CSS in the other libraries. **Planned:** 2.4c contributions; asset delivery in Phase 4.

```ts
import { fontFace } from 'zyzz/web'

fontFace({
  fontDisplay: 'swap',
  fontFamily: 'App Sans',
  fontWeight: '100 900',
  src: 'url("/fonts/app.woff2") format("woff2")',
})
const text = css({ fontFamily: '"App Sans", sans-serif' })
```

Cover multiple sources, descriptor grammar, URL handling, and side-effect retention. Public font names need explicit ownership; a generated/private font-family reference remains a design decision rather than an assumed return type. Font loading stays with the platform/build.

## 16. Globals, Layers, and Reset

Sources: Tailwind cascade layers/Preflight, vanilla-extract `globalStyle`/`layer`/`globalLayer`, external CSS integration in StyleX, and Panda `globalCss`/layers/preflight. **Planned:** 2.4c.

```ts
import 'zyzz/reset.css'
import { Config } from 'zyzz'
import { global } from 'zyzz/web'

export const zyzz = Config.create({ layers: ['reset', 'base', 'components'] })

global({
  '@layer base': {
    body: { fontFamily: 'system-ui' },
    '@media print': { body: { color: '#000' } },
  },
})

const card = zyzz.css({
  '@layer components': { padding: '1rem' },
})
```

**API accepted:** module-level declarations may live anywhere in configured project sources, including unimported modules. The source adapter hoists global contributions and a shared layer-order prelude into initial CSS. Consumers do not manually register globals or configure layer placement on `Css.compile`; the pure compiler receives explicit extracted data without global registration.

Config-bound `css` and `variants` autocomplete exact `@layer <name>` strings and reject undeclared names while preserving nested declaration/token types through imports. No returned layer-reference object or computed key is needed. Raw `global` strings receive compiler validation without ambient config inference. Unwrapped globals and scoped rules stay unlayered. Compatible order declarations merge; conflicting cycles receive diagnostics. Preserve authored rule order, stable cross-module order, nested layer hierarchy, and important reversal. Globals remain eager even beside lazy components or tree-shaken JavaScript exports. Core imports add no reset.

The [collection contract](architecture.md#layer-and-global-collection) specifies source discovery, identity, watch replacement/removal, source maps, asset relocation, shared stylesheet ownership, and packed-library metadata. [Astro](https://docs.astro.build/en/guides/styling/) and [Svelte](https://svelte.dev/docs/svelte/global-styles) provide additional colocation precedents; project-wide unimported-module collection is an explicit Zyzz decision. Browser, type, source, library, and benchmark gates remain pending in 2.4c/Phase 4.

## 17. Component Props and DOM Attributes

Sources: [StyleX `props`/`attrs`](https://stylexjs.com/docs/api/javascript/attrs), ordinary class/style consumption elsewhere. **Partial:** web `className`/style-object output. **Proposal required:** DOM attribute adapter in Phase 4.

```tsx
const button = css({ color: '#06c' })

const element = <button {...button()}>Continue</button>
```

The non-React target must retain callable application while returning `class`, serialized inline styles where needed, and data attributes. Its public adapter shape is still open; no unsupported `Css.attrs` API is implied. Test escaping, attribute serialization, real template consumers, framework updates, SSR/hydration, and packed output. Do not require framework imports in core.

## 18. Compilation, Libraries, and Build Integrations

Sources: StyleX plugins/CLI, Tailwind CLI/build tools/`@source`/`@reference`, vanilla-extract integrations/`addFunctionSerializer`, and Panda codegen/CLI/presets/static CSS. **Partial:** pure transforms and file host. **Planned:** common delivery adapters/CLI in Phase 4.

```ts
import { Transform } from 'zyzz/compiler'

const result = Transform.compile({
  moduleId: 'app/card.ts',
  source:
    "import { css } from 'zyzz'; export const card = css({ color: '#06c' })",
})
```

```sh
zyzz src --out-dir dist --css dist/styles.css --watch
zyzz src --out-dir dist --minify --targets 'chrome >= 123, firefox >= 128, safari >= 17.5'
```

Pure compilation accepts supplied text/data. CLI and optional build integrations own discovery, dependency linking, watch/HMR, assets, and stylesheet delivery. Packed libraries export generated callables and CSS without consumer authoring evaluation. Source maps, missing-transform diagnostics, editor inference, and lint integration are explicit DX gates. Final processing belongs to Lightning CSS or the consuming build, with equivalent targets and preserved semantics.

Panda's [static CSS generation](https://panda-css.com/docs/guides/static) highlights an extraction gate: all finite choices available to a runtime recipe selection must ship, even if only a default appears literally in source. Prove exported/dynamically selected recipe reachability and packed-library delivery before pruning alternatives. Keep that separate from arbitrary runtime CSS generation. Optional token/recipe documentation export, analogous to [Panda Studio](https://panda-css.com/docs/theming/studio), is Phase 5 tooling; no generated application-local SDK or runtime theme injector is required.

## 19. External Names and Contract-Only Themes

Sources: vanilla-extract global theme/contract/variable/keyframe APIs and external stylesheets across all four libraries. **Proposal required:** typed contract-only definitions and explicit global name ownership, 2.4c/Phase 4.

The immediate interoperability form uses application-owned CSS plus literal references. This does not provide an inferred external theme contract:

```css
:root {
  --app-accent: #06c;
}
[data-theme='alternate'] {
  --app-accent: #147d32;
}
@keyframes app-enter {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

```ts
const card = css({
  animationDuration: '160ms',
  animationName: 'app-enter',
  color: 'var(--app-accent)',
  '@media (prefers-reduced-motion: reduce)': { animationName: 'none' },
})
```

Specify required/missing contract leaves, domain inference, external name mapping, initialization, global fonts/layers, static variable assignments, reachability, and duplicate diagnostics. Literal interoperability is not a substitute for those typed contracts.

## 20. View Transitions

Sources: StyleX `viewTransitionClass`, vanilla-extract `createViewTransition`, ordinary CSS in Tailwind. **Deferred:** typed scoped names/classes and transition pseudo-element contributions. Illustrative external stylesheet integration:

```ts
const avatar = css({ viewTransitionName: 'profile-avatar' })
```

```css
::view-transition-old(profile-avatar),
::view-transition-new(profile-avatar) {
  animation-duration: 160ms;
}
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*) {
    animation: none;
  }
}
```

The declaration itself awaits property support. Define uniqueness, imported name identity, and transition-class grouping before a helper API. Navigation or `document.startViewTransition` orchestration belongs to the application.

## 21. Anchor Positioning and Position Fallbacks

Sources: StyleX `positionTry` and ordinary CSS positioning elsewhere. **Deferred:** declarations, restricted `@position-try` descriptors, and scoped references. External CSS target:

```ts
const trigger = css({ anchorName: '--profile-trigger' })
const popup = css({
  position: 'fixed',
  positionAnchor: '--profile-trigger',
  positionArea: 'bottom',
  positionTryFallbacks: '--profile-above',
})
```

```css
@position-try --profile-above {
  position-area: top;
}
```

These declarations await capability support. Validate fallback-only descriptors and names; they are not ordinary element style blocks. Anchor layout does not provide popover behavior or accessibility semantics.

## 22. Advanced Conditions, Timelines, and Stylesheet Rules

Sources: standard CSS reachable through the libraries; extensions beyond their dedicated helpers are tracked explicitly. **Deferred:** `@scope`, container style/scroll-state queries, scroll-driven timelines, `@counter-style`, paged media, and emerging functions. External CSS target examples:

```css
@scope ([data-article]) to ([data-article-boundary]) {
  a {
    text-decoration-line: underline;
  }
}
@container style(--density: compact) {
  .app-card {
    padding: 0.5rem;
  }
}
@container scroll-state(stuck: top) {
  .app-heading {
    border-bottom: 1px solid;
  }
}
@counter-style app-checks {
  symbols: '\2713';
  system: cyclic;
  suffix: ' ';
}
@page {
  margin: 1cm;
}
```

```ts
const reveal = css({
  animationDuration: 'auto',
  animationName: 'app-reveal',
  animationTimeline: 'view()',
  '@media (prefers-reduced-motion: reduce)': { animationName: 'none' },
})
```

The timeline preview requires an external `app-reveal` animation and future property support. Query containers require their corresponding containment setup; scroll-state queries do not select the container itself. No blanket raw-at-rule passthrough is proposed. Browser DOM/CSSOM manipulation, observers, and Web Animations orchestration are application concerns.

## 23. Native and Portable Authoring

This is a Zyzz requirement in addition to the web-library union. **Planned:** Phase 3 native subset; unsupported web semantics must error.

```ts
import { Style } from 'zyzz'
import { StyleSheet } from 'zyzz/react-native'

const styles = Style.define({ card: { padding: '1rem' } })
const native = StyleSheet.compile({
  styles,
  themes: { base: theme },
  units: { rem: 16 },
})
const selected = StyleSheet.select(native.styles, {
  colorScheme: 'dark',
  theme: 'base',
})
```

Theme labels, schemes, and style names infer from inputs. Unit conversion is explicit. Markers, DOM relationships, CSS variable text, and stylesheet rules are not native capabilities. Test real native selection/rendering separately from embedded JavaScript-engine portability.

## 24. Multipart Component Styling

Panda [slot recipes](https://panda-css.com/docs/concepts/slot-recipes), `sva`, and `defineParts` coordinate styles across component elements. **Planned through existing APIs:** Zyzz uses separate `css` or `variants` definitions for each element. Each recipe application returns one props object; the `slots` pattern is excluded from `variants` and `theme.variants`.

```tsx
const button = variants({
  base: { display: 'inline-flex' },
  defaultVariants: { size: 'sm' },
  variants: {
    size: {
      md: { padding: '1rem' },
      sm: { padding: '0.5rem' },
    },
  },
})
const label = css({ fontWeight: 600 })
const element = (
  <button {...button({ size: 'sm' })}>
    <span {...label()}>Save</span>
  </button>
)
```

Pass shared component inputs to separate recipes when multiple elements vary together. Use ordinary data attributes or the typed markers in item 11 for DOM relationships. Portals require directly applied styles because ancestor selectors do not cross DOM boundaries. Shared component inputs and separate element definitions also apply to native; DOM selectors remain web-specific.

## 25. Semantic Token Aliases and Conditional Tokens

Panda [semantic tokens](https://panda-css.com/docs/theming/tokens) add references between token leaves and condition-dependent values. **Design required:** Zyzz currently has semantic names and light/dark pairs, but no token dependency graph or arbitrary conditional token definitions.

```ts
const palette = { blue: '#06c', paleBlue: '#69f' } as const
const theme = Theme.define({
  color: { brand: { dark: palette.paleBlue, light: palette.blue } },
})
const button = theme.css({ color: 'brand' })
```

This planned static-expression example reuses values; it is not a live alias between CSS variables. A true alias must retain domain inference, cycle/missing-reference diagnostics, imported identity, and the chosen inheritance behavior when its target is overridden. Preserve token-only `Theme.define` arguments and color leaves as `string | { light, dark }`; decide a compatible reference representation before adding one. Arbitrary conditional tokens need a separate contract from CSS scheme pairs and immutable query thresholds.

## 26. Responsive Recipe Selections

Panda config recipes can expose conditional selections, with restrictions around compounds. **Design required:** Zyzz's dynamic payload selections do not imply responsive variant selection. The existing planned syntax can express a finite responsive choice:

```ts
const button = variants({
  variants: {
    size: {
      responsive: {
        padding: '0.5rem',
        '@media (width >= 48rem)': { padding: '1rem' },
      },
      sm: { padding: '0.5rem' },
    },
  },
})
const props = button({ size: 'responsive' })
```

An inferred per-condition selection API still needs a nonambiguous shape alongside `{ custom: payload }`, compound behavior, defaults/null semantics, query ordering, and native errors. Track this explicitly instead of claiming the example provides that API. [Recipes](https://panda-css.com/docs/concepts/recipes)

## Completeness Gate

Use these numbered capabilities as the shared index in the plan and architecture. Maintain a versioned property/value/selector/at-rule inventory beneath them, with independent statuses for types, extraction, emission, source maps, target compatibility, native behavior, integration proof, and benchmark coverage. A capability is complete only when its actual consumer path works.

Validate semantic equivalence before benchmarking the existing library set. Cover cold/warm/incremental compilation, matched repeated/unique styles, scopes/schemes, markers, animations, recipes, library boundaries, and real framework updates. Measure CSS, JavaScript, markup/data attributes, optional helpers, and complete raw/gzip/Brotli delivery without double-counting; do not hide unsupported comparisons or claim universal wins.

Every source API group above maps to an existing contract, a proposal, an external-CSS interoperability target, or an explicit non-goal. That classification does not make deferred APIs implemented or turn this union into a promise to duplicate each library's facade.

Column properties support `css({ columnCount: 2, columnGap: 'normal', columnRuleStyle: 'solid', columnRuleWidth: 'thin', breakInside: 'avoid-column' })`. Shared colors map to column rule colors; widths remain literal lengths. Columns and column-rule shorthands remain deferred.

Layout supports `css({ display: 'flow-root', contain: 'layout', isolation: 'isolate', zIndex: 2 })`. Float/clear include logical keywords. Image fitting and 3D layout flags accept their finite standard keywords; broader value combinations remain deferred.
