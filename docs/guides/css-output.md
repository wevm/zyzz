# CSS Output

> [!NOTE]
> Configurable output is supported by the shared compiler, source config, and version 17 packed contracts. The CSS-only CLI and complete framework/benchmark acceptance remain planned.

Choose the CSS representation on the authoring config:

```ts
import { Config } from 'zyzz'

export const { css, variants } = Config.create({
  cssOutput: 'atomic',
})
```

| Mode                 | Output                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `'atomic'` (default) | Reusable classes for individual declarations, shared wherever cascade semantics allow.              |
| `'grouped'`          | Scoped blocks containing a style's declarations, with separate blocks for selectors and conditions. |

The setting applies to config-bound styles, variants, and theme helpers. Root helpers use the atomic default. Renderer `output: 'react' | 'html'` remains separate. There is no per-style override or automatic size-based mode selection.

## Example

Authoring and application stay the same in either mode:

```tsx
namespace styles {
  export const card = css({ color: 'red', padding: '8px' })
  export const label = css({ color: 'red' })
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
.z-text-red-HASH {
  color: red;
}
.z-p-8px-HASH {
  padding: 8px;
}
```

The card receives both classes; the label receives the color class. Grouped output keeps the card's declarations together:

```css
.card-c3 {
  color: red;
  padding: 8px;
}
.label-d4 {
  color: red;
}
```

These names illustrate the representation, not a class-name API. Applications consume returned props. Native CSS cascade and explicit `cx` composition must preserve equivalent rendered behavior in both modes; class-string order is not CSS precedence.

## Class Names

Common declarations use readable labels such as `z-flex`, `z-p-8px`, and `z-text-red`. Simple pseudo-classes add a prefix, such as `z-hover-text-blue`. Complex values and fallback sequences use a deterministic six-character hash instead of embedding CSS syntax. Hash characters are letters, digits, underscores, or hyphens.

Source compilation appends an ownership hash so independently delivered modules preserve their cascade order. Conflicting declarations receive distinct hashes even when their values match. Theme and variable references participate in the hashed identity. Names remain compiler output; application code consumes returned props.

Vite development uses compact, value-independent names so CSS-only edits continue styling mounted elements. Production names include readable literal values. Low-level `Css.compile`, `Transform.compile`, and `Graph.compile` callers can select stable development naming with `development: true`.

## Semantics

Atomic sharing compares the property/value, importance, selector, conditions, cascade layer, theme/variable references, and ordering context. Identical declarations share only when doing so preserves precedence. Ordered same-property fallback sequences may remain together.

Shorthand resets, logical/physical overlap, and repeated overrides require contextual atoms or proven normalization. Atomic output must not silently fall back to grouped style blocks. Identity-only styles and interpolated selector references retain stable identities even when declaration classes are shared.

Global rules, keyframes, property registrations, font descriptors, and theme scopes retain their required CSS structures. Dynamic values bind to precompiled custom-property slots. Neither mode generates CSS rules at application time.

## Delivery

The planned CSS-only CLI and optional compiler plugin use the same mode and naming contract. Disabling the plugin requires explicit IDs for identity-bearing declarations. The plugin's default remains provisional; its presence does not select the CSS representation.

Version 17 packed libraries retain their defining mode and matching class/CSS metadata. Consumer configuration does not reinterpret published classes. Archive fixtures verify all producer/consumer mode pairs, dynamic composition, and both stylesheet orders. Complete framework lifecycle and watch acceptance remain open.

Minification and browser-target processing remain separate. Final processing may shorten or merge equivalent syntax while preserving class identity and behavior; it does not change the selected authoring mode.

Measure both modes across repeated and mostly unique styles, including CSS, JavaScript, class strings, combined transfer, compilation, and rendering. Atomic output is the default, not a claim that every workload is smaller or faster.

See [Config.create](../api/core/Config/create.md#optionscssoutput) for the option.
