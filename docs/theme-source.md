# Local Theme Compilation

The source compiler accepts module-level local `Theme.define` and `Theme.extend` calls with literal token data. Direct `theme.css` calls use the existing scalar property and token-name contract. Source is analyzed without executing application code.

```ts
import { Theme } from 'zyzz'

const theme = Theme.define({
  color: { brand: { dark: '#fff', light: '#000' } },
  spacing: { md: '8px' },
})
const alternate = Theme.extend(theme, { color: { brand: '#f00' } })

export const scope = alternate.className
export const button = theme.css({ color: 'brand', padding: 'md' })
```

Apply `scope` to an ancestor and spread `button()` onto the styled element. Scope inheritance selects token values; standard CSS `color-scheme` independently selects light or dark. A style works without a scope using its defining token fallbacks.

`Transform.compile({ moduleId, source })` returns executable module code, CSS, class/scope maps, and source maps. Module IDs include a stable package identity and relative path. Token and scope identities derive from that ID and the defining binding, independently of token values and statement offsets. Renaming a binding or module changes identity.

Theme factories and scope reads become constants. Escaping style definitions use the existing small props runtime; direct no-argument applications can fold into props constants. Generated JavaScript does not import the theme authoring implementation or generate rules. Rewritten TypeScript retains literal theme types for type queries; JavaScript inputs receive no TypeScript syntax.

`Source.extract` exposes local theme data and rewrite spans alongside ordered styles. Pass both `styles` and `themes` to `Css.compile` when using extraction without rewriting. Theme scope maps use stable module/binding keys. Theme scope rules trace to their factory; element declarations trace to their authored properties.

Themes must be local `const` bindings declared before their references. Extensions reference a preceding local theme. Literal object keys, nested palette data, numeric keys, and transparent `as`/`satisfies` wrappers are supported. Expressions, spreads, mutation, dynamic factories, aliases, destructuring, and escaping/exported theme objects receive source diagnostics.

Export compiled scope strings and style callables from this boundary. Importing/exporting theme contracts, aliases/re-exports, explicit source token paths, and cross-file dependency linking remain the next step. The file host compiles supported local themes through the same transform and rebuilds their CSS after edits.

Reading `theme.className` or calling `theme.css` without transformation throws the missing-transform error. Pure in-memory compilation continues to use `Css.compile(...).themes`; it does not read the authoring getter.
