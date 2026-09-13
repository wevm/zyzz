# variants

Defines one element's finite style choices. Import `variants` from `zyzz`; apply the returned callable through ordinary styling props.

```tsx
import { variants } from 'zyzz'

namespace styles {
  export const button = variants({
    base: { display: 'inline-flex' },
    variants: {
      size: { sm: { padding: '4px' }, lg: { padding: '12px' } },
      loading: { true: { opacity: 0.5 }, false: {} },
    },
    defaultVariants: { size: 'sm', loading: false },
    compoundVariants: [
      { when: { size: ['sm', 'lg'], loading: true }, style: { color: 'red' } },
    ],
  })
}

const button = <button {...styles.button({ size: 'lg', loading: true })} />
type ButtonProps = NonNullable<Parameters<typeof styles.button>[0]>
```

The compiler emits every finite choice and compound. Applications select attributes under a stable class, merge styling overrides, and never generate CSS. Runtime selection relies on the typed contract; structural authoring errors produce source diagnostics during compilation.

## Definition

| Field              | Behavior                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `base`             | Static styles applied before the axes.                                                         |
| `variants`         | Ordered axes containing named style choices; `true`/`false` choices accept boolean selections. |
| `defaultVariants`  | Choices used for omitted or `undefined` selections.                                            |
| `compoundVariants` | Ordered `{ when, style }` entries; arrays match any listed choice, and axes combine with AND.  |

Precedence is base, then axes in declaration order, then compounds in array order, within matching contexts and importance. Attributes add no selector specificity. Axis names use lowercase data-attribute spelling and cannot reuse styling or component-reserved props.

## Application

`styles.button()` applies defaults. A `null` selection suppresses an axis and its default. Boolean `false` emits `"false"`; it does not remove the attribute. Styling overrides use `className`, `style`, and `variables`, as with `css`.

Each recipe owns its emitted `data-*` attributes. Multipart components use separate definitions and shared component inputs. Recipes have no slots. Ordinary JSX spreads replace props; they are not a composition API.

> [!NOTE]
> Dynamic choice payloads and explicit composition follow in the Phase 3 stack. Choices currently contain static styles.

## Conditional Selections

Declare named conditions on the recipe and select overrides separately from base choices:

```ts
const button = variants({
  conditions: {
    wide: '@media (width >= 600px)',
    reduced: '@media (prefers-reduced-motion: reduce)',
  },
  variants: {
    size: { sm: { padding: '4px' }, lg: { padding: '12px' } },
    animated: { true: { transition: 'opacity 200ms' }, false: {} },
  },
  defaultVariants: { size: 'sm', animated: true },
})

button({ conditions: { wide: { size: 'lg' }, reduced: { animated: false } } })
```

Conditions support `@media` and `@supports`. Bound recipes also accept their theme's media aliases, such as `@media >=md`. Container and selector conditions are not supported for selection yet; ordinary declarations inside each choice retain their existing conditional capabilities.

Later matching conditions win independently for each axis, in recipe declaration order. Missing or `undefined` overrides inherit the earlier effective selection. `null` disables the axis, including its default. Compounds match effective choices. Switching choices removes declarations unique to the previous choice, allowing base styles and the normal cascade to apply.

CSS evaluates the conditions. Recipe calls serialize base and conditional instructions into attributes; they do not inspect the viewport, install listeners, or create CSS. These attributes carry selections, not a live reflection of the currently matching media query. SSR and client calls produce the same props for the same input.

Compilation partitions condition states to preserve null and overlap semantics. Each recipe supports up to eight named conditions, producing at most 256 regions before ordinary CSS emission. Output grows with conditions and authored choices/compounds; runtime values do not grow it. The `zyzz-condition-` axis prefix is reserved for generated attributes.

Media-list complements follow [Media Queries Level 4](https://www.w3.org/TR/mediaqueries-4/#mq-not): inactive comma-separated alternatives become intersected negated queries.

## Bound Recipes

`theme.variants` uses the theme's property-aware tokens. `Config.create` returns a bound `variants` function alongside `css`; configured recipes also preserve property mappings, ordered layer names, and React/HTML output.

```ts
import { Config } from 'zyzz'

export const { css, variants, theme } = Config.create({
  theme: { color: { brand: '#06c' } },
})
```

Bound aliases and re-exports retain their contracts through source graphs and packed libraries. Packed recipe-authoring aliases require version 15 metadata; older consumers must upgrade to read that contract. Existing CSS-only contracts retain their earlier versions.

Theme helpers can share a module-level `const` destructuring declaration, including renamed bindings:

```ts
import { Theme } from 'zyzz'

const theme = Theme.define({ color: { brand: '#06c' } })
const { css: style, variants: recipe } = theme
export { style, recipe }
```

Both helpers keep their own token-aware signatures through aliases and re-exports. Destructuring defaults, rest properties, computed keys, and nested patterns produce source diagnostics.
