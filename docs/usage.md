# Usage

Compile styles directly or transform source modules. Preview APIs are marked with notes.

## Compile Styles

```ts
import { Style } from 'zyzz'
import { Css } from 'zyzz/web'

const styles = Style.define({
  card: { display: 'flex', padding: '1rem' },
})
const output = Css.compile({ styles })
```

Load `output.css` as a stylesheet and apply `output.classes.card` to the element. The compiler has no filesystem or browser side effects. [Literal styles](literal-styles.md) documents supported values; [themes](themes.md) adds token references and compatible scopes.

## Transform Source

```ts
import { Transform } from 'zyzz/compiler'

const output = Transform.compile({
  moduleId: 'example/button.ts',
  source: `import { css } from 'zyzz';
export const button = css({ padding: '1rem' });`,
})
```

Bundle the returned `code` and load its matching `css`. Keep their source maps together. Apply the exported `button()` props to an element. A stable package-relative module ID prevents unrelated modules sharing identities. Source extraction alone does not rewrite executable calls.

For filesystem builds, `Host.create({ outDir, packageId, root })` from `zyzz/node` returns build/watch/close operations. It writes module and CSS sidecars; loading CSS and lowering TypeScript/JSX remain application build responsibilities.

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

export const { css, themes, variants } = Config.create({
  defaultTheme: 'base',
  layers: ['reset', 'base', 'components'],
  themes: {
    base,
    mint: Theme.extend(base, { color: { brand: '#175' } }),
  },
})
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

## Define Variants

> [!NOTE]
> Preview API; not yet implemented.

```tsx
import { variants } from './zyzz.config.js'

const button = variants({
  base: { display: 'inline-flex' },
  defaultVariants: { size: 'sm' },
  variants: {
    size: {
      md: { padding: 'md' },
      sm: { padding: 'sm' },
    },
  },
})

type ButtonOptions = NonNullable<Parameters<typeof button>[0]>
const example = <button {...button({ size: 'md' })}>Save</button>
```

Each recipe returns props for one element. Defaults apply to omitted selections; null suppresses a choice and its default. Compounds combine matching choice names. Finite choices compile ahead of time.

## Express Runtime Values

> [!NOTE]
> Preview API; not yet implemented.

```tsx
import { css } from 'zyzz'

const bar = css((values: { width: `${number}%` }) => ({
  width: values.width,
}))
const example = <div {...bar({ width: '50%' })} />
```

Callbacks bind values without generating CSS. Use `Vars` only when a shared variable contract is needed.

```ts
const label = css({
  color: 'black!',
  display: ['block', 'flex'],
})
```

Arrays preserve fallback order; a trailing `!` marks importance.

## Match Ancestors

> [!NOTE]
> Preview API; not yet implemented.

```tsx
import { css } from 'zyzz'
import { Css } from 'zyzz/web'

const card = Css.marker({ state: ['closed', 'open'] })
const label = css({
  [Css.ancestor(card, { data: { state: 'open' } })]: { opacity: 1 },
})
const example = (
  <section {...card({ state: 'open' })}>
    <div>
      <span {...label()}>Details</span>
    </div>
  </section>
)
```

This deliberately includes an intermediate element: the marker is an ancestor, not the span's immediate parent. `Css.descendant` checks descendants of the styled element. Helper names describe direction and depth; they do not verify DOM structure through TypeScript.

## Define Stylesheets

> [!NOTE]
> Preview API; not yet implemented.

```ts
import { fontFace, global, keyframes } from 'zyzz/web'
import { css } from './zyzz.config.js'

global({
  '@layer base': {
    body: { fontFamily: '"App Sans", sans-serif', margin: 0 },
  },
})

fontFace({
  fontDisplay: 'swap',
  fontFamily: 'App Sans',
  src: 'url("./fonts/app.woff2") format("woff2")',
})

const enter = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
})
export const notice = css({
  animationDuration: '160ms',
  animationName: enter,
  '@media (prefers-reduced-motion: reduce)': { animationName: 'none' },
})
```

- **Collection:** place static declarations at module scope in configured source files.
- **Effects:** globals and fonts survive bundling; reachable keyframes retain stable names.
- **Layers:** standalone strings receive compiler validation, without config-bound TypeScript inference.
- **Runtime:** the host collects CSS without executing application code.

## Compile With the CLI

> [!NOTE]
> Preview API; not yet implemented.

```sh
zyzz src --out-dir dist --css dist/styles.css
zyzz src --out-dir dist --css dist/styles.css --watch
zyzz src --out-dir dist --css dist/styles.css --minify
```

The CLI must rewrite authoring modules and emit matching CSS. Libraries publish both outputs and declarations. These commands are planned; use the implemented transform or file host until the CLI lands.
