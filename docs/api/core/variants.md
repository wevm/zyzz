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
> Responsive selections, dynamic choice payloads, and explicit composition follow in the Phase 3 stack. Recipes currently support static choices.

## Bound Recipes

`theme.variants` uses the theme's property-aware tokens. `Config.create` returns a bound `variants` function alongside `css`; configured recipes also preserve property mappings, ordered layer names, and React/HTML output.

```ts
import { Config } from 'zyzz'

export const { css, variants, theme } = Config.create({
  theme: { color: { brand: '#06c' } },
})
```

Bound aliases and re-exports retain their contracts through source graphs and packed libraries. Packed recipe-authoring aliases require version 15 metadata; older consumers must upgrade to read that contract. Existing CSS-only contracts retain their earlier versions.
