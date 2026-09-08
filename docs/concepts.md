# Concepts

Availability is listed in the [documentation index](README.md). Configuration, conditions, recipes, and stylesheet helpers below describe the accepted API preview.

## Definitions and Applications

A style definition describes static rules. Applying it returns styling props to spread onto an element. Static calls can become constants; dynamic inputs bind values to precompiled custom properties. Application calls never create CSS rules. Untransformed authoring calls throw instead of injecting a stylesheet.

## Configuration

`Config.create` binds `css` and `variants` to explicit token and layer contracts. Name the module `zyzz.config.ts` by convention and import its functions normally. The filename does not change the types of unrelated imports. The compiler analyzes configuration as data without executing application code.

A config accepts either one `theme` or named `themes`. Both inline tokens and reusable `Theme.define` values are supported. Named catalogs require an inferred `defaultTheme`; all entries satisfy its complete token paths and domains. With no theme, functions stay token-free.

## Themes and Color Schemes

A theme provides design values. A contract identifies their paths and allowed domains. `Theme.extend` changes existing values while preserving that contract. Independently defined themes stay isolated; config explicitly normalizes its alternatives onto a shared contract and returns the corresponding handles.

A theme scope class assigns CSS variables inherited by descendants. Changing the scope changes token values while retaining component classes. Defaults supply fallbacks outside a scope. Nested scopes select another compatible theme for a subtree.

A color's `string | { light, dark }` value is separate from theme selection. `colorScheme: 'light'` or `'dark'` selects a scheme; `'light dark'` follows browser preference. The compiler emits `light-dark()` for pairs. Selecting a theme does not force its color scheme.

## Tokens and Runtime Values

Token names infer by property: a text-color token does not become a spacing token. Explicit `theme.tokens` references retain portable domains; planned `theme.vars` references expose CSS variable values for web expressions. Query thresholds compile to literals and do not change when a theme scope changes.

Dynamic callbacks receive only their typed input values. Rule structure stays static. Styling calls consume those inputs and accept `className`/`style` overrides; handlers, accessibility attributes, children, and other component props stay on the component.

## Conditions and Relationships

Pseudo-classes, selectors, and nested `@media`, `@container`, and `@supports` blocks preserve CSS semantics. Nesting combines conditions with AND and keeps property/token inference. Raw selector/query syntax receives compiler validation; types cannot prove a matching DOM structure exists.

`Css.ancestor` and `Css.descendant` match at any depth. `parent` and `child` would imply immediate relationships and are reserved for separate future helpers. They are not aliases. Repeated instances of one marker use ordinary any-matching-ancestor semantics, not nearest-boundary matching. Container queries separately select the nearest eligible container.

Markers declare typed identity and data-state domains. Apply a marker's attributes to an element, then reference that marker in another definition. Marker attributes are visual state; they do not replace real ARIA or control attributes. Relational helpers add zero condition specificity; authored raw selectors retain their specificity.

## Variants and Composition

A variant recipe styles one element and returns one props object. Axes, defaults, and compounds describe finite alternatives; the compiler emits their rules ahead of time. Multipart components use separate definitions and ordinary shared inputs. There is no slots option.

Use `cx` to compose applied generated styles with the documented override rules. Multiple JSX spreads replace fields instead of composing them. External classes follow normal CSS precedence; their order in a class string cannot establish last-wins behavior.

## Layers and Globals

Config `layers` declares semantic order and infers literal keys such as `@layer components` in bound styles and recipe bodies. Unknown names are errors. No returned layer-reference object is needed. Additional global declarations do not ambiently widen a config's types.

`global`, `keyframes`, and `fontFace` are direct named web helpers. Globals contain selectors; keyframes contain frame declarations; font faces contain descriptors. They compile into stylesheet contributions and do not require a rendered component or runtime registry.

Collection scans configured project sources, including unimported modules, excluding tests, generated output, and dependencies by default. Collected globals are eager application-wide effects even beside lazy components. The initial stylesheet contains global rules and a shared layer-order prelude. Keyframes retain their separate reachability contract.

Layer order constraints merge deterministically; contradictory cycles fail with source locations. Unwrapped rules stay unlayered. Preserve authored rule order and standard important reversal. Source edits and deletions replace or remove contributions; relative assets remain associated with their source module.

## Compilation and Platforms

The pure core handles data, types, validation, and identity. Source adapters parse and rewrite modules. Target emitters produce CSS or native tables. Hosts own files, discovery, watching, and delivery. The CLI and build integrations share compiler semantics.

Libraries distribute matching code, CSS, declarations, and required metadata. Minification belongs to standard downstream tooling; compilation preserves ordering and gives that tooling correct CSS. Native uses precompiled styles and theme/scheme tables, with explicit errors for unsupported web selectors and stylesheet operations.
