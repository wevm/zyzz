# CSS Output

> [!NOTE]
> Configurable output is supported by the shared compiler, source config, and version 30 packed contracts. CLI and Vite support both compiler settings. Framework lifecycle tests cover both modes; performance comparisons use grouped output.

Choose the CSS representation on the authoring config:

```ts
import { defineConfig } from 'zyzz'

export const { style, variants } = defineConfig({
  cssOutput: 'atomic',
})
```

| Mode                 | Output                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `'atomic'` (default) | Reusable classes for individual declarations, shared wherever cascade semantics allow.              |
| `'grouped'`          | Scoped blocks containing a style's declarations, with separate blocks for selectors and conditions. |

The setting applies to config-bound styles, variants, and theme helpers. Root helpers use the atomic default. Renderer `output: 'react' | 'html'` remains separate. There is no per-style override or automatic size-based mode selection.

`cssOutput` and `composition` are orthogonal. Output chooses atomic declarations or grouped blocks; `composition: 'ordered'` preserves application order, while `'independent'` permits reuse of complete applications that are never combined. Existing composition options retain their meaning; neither selects nor overrides the output mode.

## Example

Authoring and application stay the same in either mode:

```tsx
namespace styles {
  export const card = style({ color: 'red', padding: '8px' })
  export const label = style({ color: 'red' })
}

function Card() {
  return (
    <section {...styles.card()}>
      <span {...styles.label()}>Label</span>
    </section>
  )
}
```

Illustrative atomic output shares the color declaration:

```css
.z-text-red {
  color: red;
}
.z-p-8px {
  padding: 8px;
}
```

The card receives both classes; the label receives the color class. Grouped output keeps the card's declarations together:

```css
.z-X8T0-w-styles-card {
  color: red;
  padding: 8px;
}
.z-X8T0-w-styles-label {
  color: red;
}
```

These names illustrate the representation, not a class-name API. Applications consume returned props. Native CSS cascade and explicit `cx` composition must preserve equivalent rendered behavior in both modes; class-string order is not CSS precedence.

## Class Names

Common declarations use readable labels such as `z-display-flex`, `z-p-8px`, and `z-text-red`. Arbitrary values appear in brackets, such as `z-filter-[blur(4px)]`. CSS selectors escape punctuation; class tokens encode whitespace reversibly. Generated names contain no hashes.

Rules that cannot share a class use their authored style name and ordered declaration slots. Grouped output also uses authored names. Consume returned props rather than constructing classnames yourself.

Variable names follow their authored paths, such as `--z-color-brand`. Standalone declarations use their binding or an explicit `variable({ id })`. Conditional fallbacks encode their complete CSS meaning rather than hashing it. These names can be longer for complex values.

When combining independent configs, supply distinct `Config.create({ id })` values. The ID prefixes the config's classes and variables. Independent standalone variables and styles can supply their own IDs. The compiler reports detectable incompatible names; consumers own collision avoidance across separately compiled stylesheets.

Contextual classes and inferred selector identities include a stable six-character hash of the module path. Modules can share a config and use the same `namespace styles` member names without collisions. Explicit style IDs remain consumer-owned.

The bundler plugins, CLI, and `Graph.compile` share responsive token defaults across module stylesheets. Next.js also shares scope definitions and the reset across components. Responsive defaults use `:where(*)` so references resolve within each theme scope. Standalone `Transform.compile` and `Css.compile` output includes the defaults needed by that compilation.

Development and production use the same naming rules. Value edits can change utility classnames. Vite updates the affected module and stylesheet together; CSS-only output with explicit style IDs retains those fixed identities.

## Semantics

Atomic deduplication accounts for property/value, importance, selector, conditions, cascade layer, theme/variable references, and ordering context. Identical declarations share only when doing so preserves precedence. Ordered same-property fallback sequences may remain together.

Shorthand resets, logical/physical overlap, and repeated overrides require contextual atoms or proven normalization. Atomic output must not silently fall back to grouped style blocks. Identity-only styles and interpolated selector references retain stable identities even when declaration classes are shared.

Global rules, keyframes, property registrations, font descriptors, and theme scopes retain their required CSS structures. Dynamic values bind to precompiled custom-property slots. Neither mode generates CSS rules at application time.

## Delivery

The CLI and Vite enable source compilation by default. `zyzz build --css-only`, `zyzz dev --css-only`, and `zyzz({ compiler: false })` retain original source. `defineConfig({ cssOutput: 'grouped' })` selects grouped CSS through every path.

Without compilation, dynamic styles, variants, variables, named themes, and selector identities require explicit IDs. Static token-free styles derive their identities from authored data. Atomic rules can share a fixed runtime selector while retaining separate declarations. No CSS rules are emitted or inserted at runtime.

Version 30 packed libraries retain their defining mode and matching class/CSS metadata. Consumer configuration does not reinterpret published classes. Archive fixtures verify all producer/consumer mode pairs, dynamic composition, and both stylesheet orders. React, Solid, Svelte, HTML, and both Next.js bundlers verify matching rendering and updates.

Minification and browser-target processing remain separate. Final processing may shorten or merge equivalent syntax while preserving class identity and behavior; it does not change the selected authoring mode.

Performance comparisons use grouped output across repeated and mostly unique styles, including CSS, JavaScript, class strings, combined transfer, compilation, and rendering. Atomic remains the application default and has correctness coverage; no atomic performance advantage is claimed.

See [defineConfig](../api/core/Config/create.md#optionscssoutput) for the option.

With explicit `composition: 'independent'`, complete applications are never combined. The emitter may factor a shared block from independent grouped styles while retaining each conflicting declaration domain intact. The default composition keeps a style’s declarations together.

## Unused Styles

Production source compilation removes CSS for provably unused local `const` styles and unused members of local style objects or namespaces. Exported definitions and escaped containers remain available. References between namespace members keep their dependencies live, and every alternative of a live variant remains emitted.

Pruning preserves definition positions, authored cascade order, and complete live theme token scopes. It does not change eager stylesheet contributions. Development and CSS-only compilation retain all definitions. Dynamic property access, `eval`, and ambiguous bindings prevent pruning rather than risking missing CSS.
