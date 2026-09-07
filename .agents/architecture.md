# Architecture and API

## Status

This is the proposed API contract for the implementation phases in [the plan](plan.md). Only the existing `css()` web shorthand is implemented. Theme definitions, named styles, target compilers, and native selection below are planned APIs.

## Boundaries

The core operates on typed, ordered style data. Validation, token contracts, and deterministic identity are pure operations with no filesystem, browser, device, parser, framework, or build-tool dependencies.

| Module          | Responsibility                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| Core            | Style definitions, theme contracts, ordered declarations, validation, diagnostics                      |
| Presets         | Optional colors, typography, spacing, radius, and condition aliases                                    |
| Source adapters | Extract static definitions, resolve supplied imports, retain source locations, rewrite authoring calls |
| Web target      | Emit CSS, class names, theme scopes, and web capability errors                                         |
| Native target   | Emit static style tables and native capability errors                                                  |
| Host adapters   | Read files, watch dependencies, deliver artifacts, integrate build lifecycles                          |

Use modules and subpath exports first. Extensions receive explicit data or narrow functions. Frameworks consume their platform's normal class or style API; providers and component wrappers are unnecessary.

Source extraction produces the same data accepted directly by the in-memory compilers. Filesystem resolution, parsing, emission, and artifact delivery remain separate operations. The core never executes application source or detects its environment.

## Authoring API

The existing web shorthand remains:

```ts
import { css } from 'typestyle'

const button = css({
  paddingInline: 4,
  borderRadius: 'md',
  color: 'blue.700',
})
```

Its compiled result is a class-name string plus extracted CSS. The prototype accepts literal objects and its built-in tokens. Imported theme references and the following named-definition API require the planned extraction work.

Named definitions preserve property names, style names, and token domains through inference:

```ts
import { Style, Theme } from 'typestyle'

export const ocean = Theme.define({
  contract: 'app',
  name: 'ocean',
  tokens: {
    space: { sm: '0.5rem', md: '1rem' },
    radius: { md: '0.5rem' },
  },
  colorSchemes: {
    light: {
      color: { surface: '#ffffff', text: '#171717', accent: '#0066cc' },
    },
    dark: {
      color: { surface: '#111111', text: '#ededed', accent: '#66aaff' },
    },
  },
})

export const styles = Style.define({
  card: {
    padding: ocean.tokens.space.md,
    borderRadius: ocean.tokens.radius.md,
    color: ocean.tokens.color.text,
    backgroundColor: ocean.tokens.color.surface,
  },
})
```

`Style.define(styles)` returns immutable named definition data, preserving literal names. It does not generate classes or mutate a global registry. Target compilers accept these definitions; source adapters replace their application references with generated target exports.

Property and value types follow CSS spelling and syntax. Token references carry their domain and contract: a spacing reference cannot satisfy a color property. Target capability validation rejects unsupported properties, selectors, functions, and units with source locations when available.

## Theme API

| Call                           | Input                                                                                                   | Result                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `Theme.define(options)`        | Stable `contract`, theme `name`, shared `tokens`, complete `colorSchemes.light` and `colorSchemes.dark` | Immutable definition with inferred, opaque `tokens` references      |
| `Theme.extend(theme, options)` | New `name`, optional partial shared tokens and partial scheme overrides                                 | Complete theme retaining the original contract and token references |

Every theme defines both schemes with exactly matching color keys. Scheme-dependent colors appear under `colorSchemes`; shared spacing, radius, and typography belong under `tokens`. `theme.tokens.color` exposes semantic references without choosing a scheme.

The contract identifier and domain/key paths determine token identity, independently of theme names and values. A contract identifier must have one schema within a compilation. Different contract identifiers remain isolated; compatible themes share references through `Theme.extend()`.

```ts
export const forest = Theme.extend(ocean, {
  name: 'forest',
  colorSchemes: {
    light: { color: { accent: '#147d32' } },
    dark: { color: { accent: '#65d982' } },
  },
})
```

Extension resolves missing overrides from the base at compile time. It cannot add token keys or change token domains. Each emitted theme contains the complete resolved token set, preventing values from an outer theme leaking into a nested theme.

Unknown keys, missing scheme colors, mismatched domains, conflicting contract schemas, duplicate theme names, and unresolved theme references are errors. Literal inference provides authoring errors; compiler validation also protects data received from untyped callers.

Theme values must be statically resolvable. Presets supply ordinary definition data using the same contract. Color literals are portable where supported by the target; target-specific CSS expressions remain web capabilities and produce native errors when conversion is unavailable.

## Web compilation and color schemes

```ts
import * as Web from 'typestyle/web'

const web = Web.compile({ styles, themes: [ocean, forest] })

web.css // Complete stylesheet string.
web.classes.card // Class-name string for this named style.
web.themes.ocean // Theme scope class-name string.
web.themes.forest // Compatible theme scope class-name string.
```

`Web.compile(options)` is a pure, in-memory build operation. It returns `{ css, classes, themes }` with inferred style and theme names. Invalid inputs throw `Web.CompileError` containing structured diagnostics. Host adapters decide filenames, imports, caching, and how to preserve previous artifacts on failure.

Applications consume generated constants and CSS, without calling the compiler during rendering. Libraries distribute those artifacts and declarations directly; their consumers do not need source extraction.

Theme scopes emit CSS custom properties. Scheme-dependent color values use the standard `light-dark()` function. Style classes reference those properties, so changing themes does not require regenerating component classes. Shared tokens emit ordinary custom properties.

Theme selection and color-scheme selection are independent. A theme scope does not force a scheme. Use normal CSS to select the scheme on the root or any subtree:

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

`light dark` allows the browser to select a supported scheme using user preference. `light` and `dark` force that scheme for the scope. There is no third stored “system” scheme. Without an explicit supported scheme, standard browser behavior applies; the compiler does not install a preference listener.

Generated theme classes define values without overriding inherited `color-scheme`. Nested theme scopes replace the full contract; nested scheme scopes change color selection while retaining the theme. Apply at most one theme class per contract on an element. Multiple independent contracts can coexist.

The web target follows [CSS color-scheme](https://www.w3.org/TR/css-color-adjust-1/#color-scheme-prop) and [light-dark()](https://www.w3.org/TR/css-color-5/#light-dark). Browser acceptance tests must cover nested scopes, inherited custom properties, forced schemes, preference changes, and server-rendered markup before this output strategy is accepted.

## Native compilation and selection

```ts
import * as Native from 'typestyle/native'

const native = Native.compile({
  styles,
  themes: [ocean, forest],
  units: { rem: 16 },
})

native.styles.ocean.light.card // Static platform style object.
native.styles.ocean.dark.card // Another precompiled scheme.

const selected = Native.select(native.styles, {
  theme: 'forest',
  colorScheme: 'dark',
})

selected.card // Reference to the precompiled object.
```

`Native.compile(options)` returns `{ styles }`, indexed by theme name, scheme, and style name. It throws `Native.CompileError` with diagnostics for unsupported semantics. Both schemes for every supplied theme are resolved ahead of time; no CSS custom-property resolution occurs on the device.

Conversions are explicit: `units.rem` is required when definitions use `rem`. Font mappings are supplied by the target adapter when needed. Unsupported units or CSS-only behavior fail compilation; the target never silently approximates selectors, cascade, or inheritance.

`Native.select(table, options)` is an optional pure lookup that preserves object identity. Its inferred inputs accept only compiled theme names and `light | dark`. Invalid untyped inputs throw `Native.SelectionError`. It does not merge styles, parse values, compile, or read device preferences.

An application adapter resolves the device preference to `light` or `dark` and passes that value explicitly. Framework state can distribute this choice using normal platform patterns. Web class references and native style objects remain distinct output types.

## Static extraction, ordering, and delivery

Adapters recognize `css()`, `Style.define()`, `Theme.define()`, and `Theme.extend()` with literals and statically resolvable bindings. Import resolution is an injected source-adapter capability. Arbitrary function calls, runtime branches, and unresolved values produce actionable compile errors.

Preserve authored declaration order and standard web cascade behavior. Class concatenation does not change stylesheet precedence. Native composition follows the platform contract. Optional condition aliases expand predictably without hidden ordering changes.

Style identities depend on canonical ordered declarations and token references. Theme scope identities also include resolved theme content. Compiling identical inputs produces identical output across hosts; emitted token names remain stable when only a compatible theme's values change.

Development adapters track style and theme dependencies, update affected artifacts, and report errors beside source. Production adapters invoke the same compiler. The standalone adapter writes compiled modules, CSS, and declarations for libraries. No host owns an alternative implementation of theme or style semantics.

## Acceptance and migration

The existing 29 tests establish the web prototype baseline. Refactor extraction and emission before adding target APIs. Implement theme inference and both color schemes before native selection and additional host integrations.

API type fixtures must reject wrong token domains, incomplete schemes, unknown overrides, and invalid selection names. Behavioral fixtures must verify theme switching without component recompilation, nested scopes, deterministic artifacts, explicit native conversions, and lookup identity. The phased gates remain in [the plan](plan.md).
