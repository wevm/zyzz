# Usage

Sections marked **Available** work at the documented current boundary. **Preview** sections describe accepted APIs that still require implementation. See [availability](README.md#availability).

## Compile Styles — Available

```ts
import { Style } from 'zyzz'
import { Css } from 'zyzz/web'

const styles = Style.define({
  card: { display: 'flex', padding: '1rem' },
})
const output = Css.compile({ styles })
```

Load `output.css` as a stylesheet and apply `output.classes.card` to the element. The compiler has no filesystem or browser side effects. [Literal styles](literal-styles.md) documents supported values; [themes](themes.md) adds token references and compatible scopes.

## Transform Source — Available

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

## Configure Authoring — Preview

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

## Apply Styles and Themes — Preview

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

The theme class selects inherited variables. The inline property selects the color scheme. Unknown layer and token names fail type checking. Use `className` and `style` inputs for styling overrides; other props stay on the element.

## Define Variants — Preview

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

## Express Runtime Values — Preview

```tsx
import { css } from 'zyzz'

const bar = css((values: { width: `${number}%` }) => ({
  width: values.width,
}))
const example = <div {...bar({ width: '50%' })} />
```

Callbacks define value bindings, not runtime CSS generation. Arrays express ordered declaration fallbacks, and a trailing `!` marks an important value. Explicit shared variable contracts use `Vars`; local values usually use callbacks.

## Match Ancestors — Preview

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

## Define Stylesheets — Preview

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

Place these declarations at module scope in any configured source file. Globals and font contributions retain stylesheet effects; reachable keyframes retain stable names. The host collects CSS without executing these functions in the application. Raw global layer strings receive compiler validation; they do not inherit a config's TypeScript catalog.

## Compile With the CLI — Preview

```sh
zyzz src --out-dir dist --css dist/styles.css
zyzz src --out-dir dist --css dist/styles.css --watch
zyzz src --out-dir dist --css dist/styles.css --minify
```

The CLI must rewrite authoring modules and emit matching CSS. Libraries publish both outputs and declarations. These commands are planned; use the implemented transform or file host until the CLI lands.
