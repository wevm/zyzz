# CSS Parity Audit

Audited 2026-09-08 against main `9aa72fc` after PR #10. This is a capability audit of the referenced libraries, not a claim of complete CSS standards conformance. “Planned” means specified but unimplemented; “design required” means the public contract still needs a decision.

## Current Coverage

The implementation validates 40 literal CSS properties in `src/internal/Literal.ts`, six scalar theme groups, portable token references, inherited theme scopes, and token-name resolution. Source rewriting supports direct literal root `css` calls. Bound `theme.css` has inference but still requires the upcoming theme-aware transform. Selectors, queries, keyframes, global/font rules, dynamic bindings, variants, CLI, and native stylesheet output are not implemented.

The plan already names most common capabilities. Its gaps were explicit completeness tracking, relational-selector behavior, keyframe edge cases, CSS variable registration, and newer stylesheet constructs. A typed input alone does not establish parser, emitter, browser, packaging, or native support.

## StyleX API Mapping

The [API index](https://stylexjs.com/docs/api) provides the baseline inventory:

- `create` → `Style.define` and callable `css`; partially implemented.
- `props` → callable application plus planned `cx`; conflict-aware composition remains Phase 3.
- `defineVars`, `createTheme` → `Theme.define`/`Theme.extend`; source/library identities remain 2.2b.
- `defineConsts` → imported immutable values and static expression analysis; planned, without a second token system.
- `firstThatWorks` → ordered fallback arrays; planned. Preserve CSS fallback order rather than copying argument-order conventions.
- `keyframes` → `Css.keyframes`; planned.
- `StyleXStyles`, `StyleXStylesWithout`, `StaticStyles`, `Theme`, `VarGroup` → public style/theme/reference types, `Parameters`, and planned property-restricted composition contracts. Test exclusions and cross-package assignability.
- Build plugins and CLI → common compiler plus optional adapters; Phase 4.

`attrs` exposes `class` and serialized inline styles. Framework-agnostic compilation does not make `className` props universal: define an explicit DOM-attribute output adapter and test serialization/escaping with real template consumers in Phase 4. [Attribute output](https://stylexjs.com/docs/api/javascript/attrs)

`when.*`, `defaultMarker`, and `defineMarker` cover ancestor, descendant, preceding/following/any-sibling relationships. Zyzz should express these with scoped standard selectors and named data attributes first. Raw relationships must retain CSS specificity, including explicit `:where()`; no hidden relation-priority ladder is proposed. [Contextual selectors](https://stylexjs.com/docs/api/javascript/when)

`types.*` generates registered custom properties. The current `Vars` plan types values but does not specify `@property` descriptors. Registration, initialization, inheritance, interpolation, and duplicate-registration errors need design in 2.3. [Typed variables](https://stylexjs.com/docs/api/javascript/types)

`positionTry` and `viewTransitionClass` expose separate stylesheet constructs. Track anchor fallback descriptors, scoped identities, transition names/classes, and transition pseudo-elements as later web capabilities. They must not be accidentally treated as ordinary element rules. [Position fallbacks](https://stylexjs.com/docs/api/javascript/positionTry), [view transitions](https://stylexjs.com/docs/api/javascript/viewTransitionClass)

`env.*` does not require a matching configuration API: explicit imports and ordinary theme tokens cover reusable values, while arbitrary configured function execution remains outside the core. [Environment configuration](https://stylexjs.com/docs/api/javascript/env)

`@stylexjs/atoms` supplies inline property helpers. Zyzz covers the same authoring position with inline `css` and planned dynamic bindings; an additional property-access facade is unnecessary for parity. [Inline atoms](https://stylexjs.com/docs/api/javascript/atoms)

## Tailwind Capability Mapping

The [utility reference and state guide](https://tailwindcss.com/docs/hover-focus-and-other-states) are a checklist of CSS behavior, not a requirement to reproduce utility names.

- Declarations: expand layout/positioning, grid/flex, logical spacing/sizing, typography, backgrounds/gradients, borders/outlines, shadows, transforms, filters/masks, tables, interactivity, scrolling, SVG, and accessibility property families.
- States: cover focus/hover/active/visited, form validation, structural/nth selectors, empty/target, attribute/ARIA/data states, direction, open/popover/inert, and negation.
- Relationships: named groups and peers, descendants of groups/peers, preceding/following siblings, direct/all children, and arbitrary scoped selectors.
- Pseudo-elements: before/after, placeholder, selection, marker, file selector, first letter/line, and backdrop.
- Conditions: responsive/container queries, schemes, motion/contrast/forced colors, pointer/hover capability, orientation, print, scripting, feature queries, and `@starting-style`.

Zyzz keeps literal `:hover` semantics. A pointer-capable hover effect is authored inside `@media (hover: hover)`; it is not silently added to every pseudo. `::before` and `::after` require authored `content`; no implicit content or global reset is injected.

`@theme` maps to explicit themes; `@utility`/`@apply` to reusable styles and composition; `@variant`/`@custom-variant` to reusable static condition objects; `@source`/`@reference` to adapter input/dependency discovery. CSS math, color mixing, and theme variables use standard CSS values. Standard CSS imports and asset URLs belong to the consuming build or explicit file adapter. Legacy config/plugin compatibility is not a core requirement. [Functions and directives](https://tailwindcss.com/docs/functions-and-directives)

Opt-in reset behavior, external CSS coexistence, theme color opacity expressions, arbitrary values, and statically discoverable exported styles need their own fixtures. Responsive condition syntax and recipe variants are separate concepts.

## Vanilla-Extract API Mapping

The [API navigation](https://vanilla-extract.style/documentation/api/style/) lists these capability groups:

- `style`, `styleVariants` → `css`, named definitions, and planned `variants`.
- `createTheme`, `createThemeContract` → definitions/extensions; contract-only or externally supplied theme values still need an explicit interoperability decision.
- `createVar`, `assignVars`, `fallbackVar` → planned `Vars`, static assignments, and nested CSS `var()` fallbacks. Declaration fallback arrays are a different mechanism.
- `fontFace`, `keyframes`, `layer` → planned `Css` contributions and layer ordering.
- `createContainer` → planned named-container support; private generated names across packages need explicit identity handling.
- `createViewTransition` → deferred scoped transition-name support.
- Global style/theme/contract/variable/font/keyframe/layer counterparts → global contributions plus external-name interoperability. Explicit public names and side-effect retention need contracts; scoped output alone is insufficient.
- Sprinkles/Recipes/Dynamic/CSS Utils → theme inference, recipes, runtime variable assignment, and supported static CSS expressions; no duplicate facade per package.

Variable registration also exists here; verify descriptor handling, not just TypeScript annotations. [Variable API](https://vanilla-extract.style/documentation/api/create-var/)

`addFunctionSerializer` serves reusable compiled library functions. Zyzz's source linking, generated callable exports, and packed-consumer tests cover that goal without requiring arbitrary authoring execution. [Library serialization](https://vanilla-extract.style/documentation/api/add-function-serializer/)

## DX Recommendation

Use `:hover` and other pseudos directly, `&` for relationships, named `data-*` markers for groups/peers, and `Css.keyframes` for reusable animation references. Concrete examples and specificity rules are in [architecture](architecture.md#relational-selector-dx). This extends the agreed object syntax instead of introducing a parallel utility language.

The requested group-descendant case is an ancestor with `:has(a)` affecting the current element. It is not the same as `&:has(a)`, which inspects the current element's descendants. [Group descendants](https://tailwindcss.com/docs/hover-focus-and-other-states#styling-based-on-the-descendants-of-a-group)

Named markers are authored values, not automatically private namespaces. Distinct names isolate different groups; reusing the same name in nested groups matches any qualifying ancestor. A nearest-group boundary or generated marker helper needs a separate explicit contract if later added.

## Completeness Gate

Maintain a versioned capability inventory with one row per property, value family, pseudo, selector form, conditional rule, and stylesheet rule. Record type support, extraction, emission, source maps, browser targets, native behavior, integration fixture, and delivery benchmark. A row is complete only when its real consumer path works.

Phase 2.3 owns property/value expansion and variable registration design. Phase 2.4a owns theme/query metadata; 2.4b owns selectors/conditions; 2.4c owns animation/global/font/layer contributions. Phase 3 owns recipes/composition/native parity, and Phase 4 owns renderer output and packed-library interoperability.

Explicit later backlog: `@scope`, container style/scroll-state queries, view transitions, anchor positioning/`@position-try`, scroll-driven timelines, `@counter-style`, paged-media rules, and newer CSS functions/at-rules. Unknown grammar must receive a located unsupported-capability diagnostic until supported. Browser DOM/CSSOM manipulation, Web Animations orchestration, and JavaScript layout observers remain application concerns.

No claim that all CSS APIs are covered is justified yet. The audit adds the missing work and decisions; it does not turn deferred capabilities into MVP promises or implemented features.
