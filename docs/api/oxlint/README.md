# zyzz/oxlint

Oxlint rules for Zyzz web styles. The plugin checks source without evaluating application code or loading imported configuration modules. It does not change declaration order or replace compilation and TypeScript checking.

## Setup

Install `oxlint` alongside `zyzz`, then register the plugin in `.oxlintrc.json`:

```json
{
  "jsPlugins": [{ "name": "zyzz", "specifier": "zyzz/oxlint" }],
  "rules": {
    "zyzz/no-conflicting-props": "error",
    "zyzz/no-unused": "warn",
    "zyzz/valid-styles": "error"
  }
}
```

Run `oxlint .`. Registration alone enables no rules. Logical-property preferences and project restrictions are opt-in. Integration coverage uses Oxlint 1.72.0 and Vite Plus 0.2.2. Oxlint's JavaScript plugin API is currently alpha.

Vite Plus accepts the same configuration under `lint` in `vite.config.ts`:

```ts
import { defineConfig } from 'vite-plus'

export default defineConfig({
  lint: {
    jsPlugins: [{ name: 'zyzz', specifier: 'zyzz/oxlint' }],
    rules: {
      'zyzz/no-conflicting-props': 'error',
      'zyzz/valid-styles': 'error',
    },
  },
})
```

## Imports

Rules recognize `zyzz`, `zyzz/default`, and imports whose final filename matches `zyzz.config.*`, such as `./zyzz.config.ts`, `../zyzz.config.mjs`, or `@/zyzz.config.js`. No settings are needed for these configuration filenames.

Named aliases, namespace imports, immutable local aliases, and helpers destructured from local `Config.create()` calls are supported. Lexical shadowing is respected. Modules with other filenames can be registered explicitly:

```json
{
  "settings": {
    "zyzz": {
      "imports": ["@/styles.js"]
    }
  }
}
```

Entries match import specifiers exactly and supplement automatic recognition. Configuration filenames are matched on the import text without filesystem resolution. Recognized configuration modules are assumed to expose Zyzz helpers. The linter does not resolve arbitrary re-exports, imported style definitions, token contracts, or custom shorthand mappings across files.

Declaration rules visit `style()` objects and callback returns, variant bases and choices, compound styles, selectors, conditions, and `targets.web`. Variant names, selection metadata, variable assignment containers, arbitrary callback expressions, and native target branches are excluded. Apply these web rules only to web authoring files through Oxlint overrides.

## Rules

### valid-styles

Reports unknown properties in token-free styles, malformed value markers, empty or sparse fallback arrays, known nonscalar declaration values, and literal structures that cannot describe styles. Existing Zyzz validation owns value-marker and fallback diagnostics.

```ts
import { style } from 'zyzz'

// ❌ Invalid: empty fallbacks and malformed importance.
style({ display: [], color: 'red!important' })

// ✅ Valid.
style({ display: ['block', 'flex'], color: 'red !important' })
```

Unresolved expressions are left to the compiler. Configured helpers may define shorthand properties, so unknown-property checks apply only to token-free imports. This rule does not validate complete CSS grammars, configured token membership, or every compiler restriction. No options or automatic fixes.

### no-conflicting-props

Reports explicit JSX `className` or `style` attributes alongside known Zyzz application spreads, regardless of attribute order. Multiple known application spreads also conflict. Pass overrides into a style call and compose applications with `cx`.

```tsx
import { cx, style } from 'zyzz'

namespace styles {
  export const card = style({ padding: '16px' })
  export const selected = style({ opacity: 0.8 })
}

// ❌ Invalid: the explicit attribute replaces the generated class.
const invalid = <div {...styles.card()} className="external" />

// ✅ Valid: merge overrides or compose applications.
const valid = <div {...styles.card({ className: 'external' })} />
const composed = <div {...cx(styles.card(), styles.selected())} />
```

Detection covers locally resolved definitions and `cx` imports. Unknown spreads and imported style definitions are skipped. This rule targets React-style web props. No options or automatic fixes, since merging expressions can change evaluation order.

### use-logical-properties

Reports the physical horizontal properties and corner radii covered by Tempo's [logical-property policy](https://github.com/tempoxyz/tempo.xyz/blob/4544c69b7535974bf0ff97a222be31b8f1b2f3f7/config/oxlint/logical-properties.ts). Diagnostics suggest a logical property for horizontal LTR layouts. Choosing the intended direction and writing mode remains an authoring decision.

```ts
import { style } from 'zyzz'

// ❌ Invalid when this rule is enabled.
style({ marginLeft: '16px', paddingRight: '8px' })

// ✅ Valid: use logical properties.
style({ marginInlineStart: '16px', paddingInlineEnd: '8px' })

// ✅ Valid: explicitly allow an intentional physical edge.
style({
  // allow-physical-property
  left: '0px',
})
```

Enable with `"zyzz/use-logical-properties": "warn"`. Standard `oxlint-disable-next-line zyzz/use-logical-properties` comments also work. No options or automatic fixes. The rule does not expand the policy to vertical properties, physical keyword values, or shorthand values.

### no-unused

Reports unused style and variant definitions inside local, top-level TypeScript namespaces. Ordinary local bindings remain the responsibility of Oxlint's `no-unused-vars`.

```tsx
import { style } from 'zyzz'

namespace styles {
  // ✅ Valid: applied below.
  export const card = style({ padding: '16px' })
  // ❌ Invalid: never used.
  export const unused = style({ color: 'red' })
}

const element = <div {...styles.card()} />
```

Only `styles.unused` is reported. Exported or merged namespaces, nested namespaces, computed member access, and namespaces passed as values are retained conservatively. Direct references between namespace members count as uses. No options or automatic removal.

### restricted-properties

Accepts one object keyed by exact authored property names. Each restriction has an optional `reason` and `values` array of allowed strings or numbers. Omitting `values` bans the property, including dynamic values. Providing `values` checks only statically resolved literals and fallback arrays.

```json
{
  "rules": {
    "zyzz/restricted-properties": [
      "error",
      {
        "color": { "reason": "Use color tokens.", "values": [] },
        "padding": {
          "reason": "Use the spacing scale.",
          "values": [0, "4px", "8px"]
        },
        "zIndex": { "reason": "Use a stacking context." }
      }
    ]
  }
}
```

Under this configuration:

- ❌ Invalid: `color: '#ff0000'`, `padding: '7px'`, and any `zIndex` declaration.
- ✅ Valid: `color: theme.tokens.color.accent` and `padding: '4px'`.

An empty `values` array rejects known literals but does not prove that unresolved expressions are tokens. No automatic fixes.

All rules support standard Oxlint suppression comments. None require TypeScript type-aware linting.
