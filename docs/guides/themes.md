# Use Themes

Define shared tokens, then select their values through an inherited theme scope.

## Configure Authoring

> [!NOTE]
> Preview API; not yet implemented.

```ts
// zyzz.config.ts
import { Config, Theme } from 'zyzz'

const base = Theme.define({
  color: { brand: { dark: '#8cf', light: '#06c' } },
  spacing: { md: '1rem', sm: '0.5rem' },
})

const config = Config.create({
  defaultTheme: 'base',
  layers: ['reset', 'base', 'components'],
  themes: {
    base,
    mint: Theme.extend(base, { color: { brand: '#175' } }),
  },
})

export const { css, themes, variants } = config
export const variables = themes.base.vars
export default config
```

Single-theme configs use `theme: base`, or put the tokens inline. Named catalogs also accept complete inline alternatives. Import returned functions normally; there is no implicit global token or layer registry.

## Apply Styles and Themes

> [!NOTE]
> Preview API; not yet implemented.

```tsx
import { css, themes } from './zyzz.config.js'

const button = css({
  '@layer components': {
    backgroundColor: 'brand',
    padding: 'md',
    ':hover': { opacity: 0.8 },
  },
})

const example = (
  <section className={themes.mint.className} style={{ colorScheme: 'dark' }}>
    <button {...button()} type="button">
      Save
    </button>
  </section>
)
```

- **Color scheme:** selected through the inline property.
- **Overrides:** pass `className`/`style` to the styling function; keep other props on the element.
- **Theme:** selected through the scope class.
- **Types:** reject unknown layers and token names.
