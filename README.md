# typestyle

A proof of concept for typed style props that compile to static CSS. Geist colors and typography, Tailwind design tokens, one authoring function.

```ts
import { css } from 'typestyle'

const button = css({
  typography: 'button.14',
  color: 'white',
  backgroundColor: 'blue.700',
  paddingInline: 4,
  paddingBlock: 2,
  borderRadius: 'md',
  ':hover': { backgroundColor: 'blue.800' },
  '@md': { paddingInline: 6 },
})
```

`button` compiles to a class-name string. It works with `className={button}`, `class={button}`, or DOM APIs. A call can also appear directly in JSX. No custom JSX runtime or style-file extension is required.

```tsx
<button className={css({ typography: 'button.14', padding: 4 })}>
  Continue
</button>
```

## Try the POC

Node 22.18+ or 24.11+; pnpm 11.19.0. The package is private and has not been published to npm.

```sh
pnpm install
pnpm build
pnpm dev
```

The Vite example includes Geist font assets, light/dark switching, responsive typography, and keyboard focus/press states. The core package emits font stacks; applications choose how to load fonts.

## Vite

```ts
import { defineConfig } from 'vite'
import { typestyle } from 'typestyle/vite'

export default defineConfig({ plugins: [typestyle()] })
```

The same plugin compiles development and production. Dev uses Vite's CSS updates and error overlay; production emits stylesheet assets and removes the authoring API from JavaScript. No second watch command or checked-in generated styles are needed.

Run `tsc --noEmit` alongside Vite or in CI. Like Vite itself, the plugin does not run the full TypeScript checker. It independently checks the static subset and token resolution.

## Tokens and values

| Property group     | Example                                                      | Meaning                                                                              |
| ------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Spacing and sizing | `padding: 4`, `gap: 2.5`                                     | Tailwind v4's numeric 0.25rem unit                                                   |
| Negative offsets   | `marginTop: -2`                                              | -0.5rem; negative padding is rejected                                                |
| One pixel          | `padding: 'px'`                                              | 1px                                                                                  |
| Full size          | `width: 'full'`                                              | 100%                                                                                 |
| Colors             | `color: 'gray.1000'`, `backgroundColor: 'blue.100'`          | Geist light/dark palette pairs                                                       |
| Typography         | `typography: 'heading.32'`, `typography: 'copy.14'`          | Geist family, size, leading, weight, tracking, and applicable strong-child semantics |
| Radius             | `borderRadius: 'lg'`                                         | Tailwind v4, 0.5rem                                                                  |
| Shadow             | `boxShadow: 'sm'`                                            | Tailwind v4 small shadow                                                             |
| Font               | `fontFamily: 'mono'`                                         | Geist Mono stack                                                                     |
| Border             | `borderWidth: 1`                                             | Pixels                                                                               |
| Motion             | `transitionDuration: 150`, `transitionTimingFunction: 'out'` | Milliseconds and Tailwind easing                                                     |
| CSS keywords       | `display: 'flex'`                                            | Property-specific TypeScript keyword completion                                      |
| Explicit escape    | `width: '[calc(100% - 2rem)]'`                               | A literal CSS value outside token validation                                         |

All 92 Geist sRGB values are included: two backgrounds and ten steps each of gray, gray-alpha, blue, red, amber, green, teal, purple, and pink. The preset names use `heading.32`, `label.14`, `label.14-mono`, `copy.14`, and `button.14` conventions. TypeScript completion lists the full set.

Colors compile to `light-dark(...)`. Set `color-scheme: light dark` for the system preference, or `light`/`dark` on a theme root. The POC targets modern browsers supporting `light-dark()`. There is no injected theme provider. P3 enhancements and configurable theme variables are planned.

## Conditions

```ts
const control = css({
  padding: 3,
  ':focus-visible': {
    outlineWidth: 2,
    outlineStyle: 'solid',
    outlineColor: 'blue.700',
  },
  '&[data-checked]': { backgroundColor: 'blue.100' },
  '@hover': { ':hover': { backgroundColor: 'gray.200' } },
  '@md': { padding: 4 },
  '@motion-reduce': { transitionDuration: 0 },
})
```

Breakpoints are `@sm`, `@md`, `@lg`, `@xl`, and `@2xl`. Supported pseudo-classes and data-attribute selectors can nest inside conditions. Breakpoints emit from small to large regardless of object key order. Explicit declarations override typography presets.

## Libraries without a consumer compiler

```sh
pnpm build
node dist/cli.js examples/library/src --out-dir examples/library/dist
```

Output contains ESM modules, `.d.ts` declarations, `styles.css`, and an internal build manifest. A repeat build updates generated files and removes obsolete owned output. Compilation failures preserve the last good build. Existing unowned output files are never replaced.

The same operation is available programmatically:

```ts
import * as Build from 'typestyle/build'

await Build.build({ sourceDir: 'src', outDir: 'dist' })
```

The standalone build checks source types and compiles modules; it does not bundle third-party dependencies or copy arbitrary assets. Source ESM imports should use `.js` extensions. A published library can expose:

```json
{
  "type": "module",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./styles.css": "./dist/styles.css"
  },
  "sideEffects": ["**/*.css"]
}
```

Its consumer imports the CSS once:

```ts
import { button } from 'example-library'
import 'example-library/styles.css'
```

Consumers need neither the typestyle Vite plugin nor a browser styling runtime. Font loading remains an application concern.

## Current boundaries

- Styles must be literal objects. Same-module constants, imported values, spreads, computed keys, and function calls inside styles are not supported yet. TypeScript's structural types cannot prove staticness; the compiler enforces this separately.
- Dynamic UI state selects precompiled classes, for example `active ? activeClass : idleClass`. Runtime values cannot generate new styles.
- Each call emits one scoped rule group. Combining classes follows the native CSS cascade; string order is not an override guarantee. Conflict-aware composition and atomic CSS are deferred.
- The registry covers common properties, not all CSS. Use an explicit `[value]` for arbitrary values on supported properties. Arbitrary values opt out of token checking.
- Class names depend on style content. Style edits also invalidate JavaScript; state preservation follows the framework's normal HMR behavior. The vanilla example can reload.
- Vite 8.2.2 is verified. The declared Vite 7/8 peer range uses shared hooks, but Vite 7 and SSR are not yet verified.
- Standalone watch mode, composed standalone source maps, configurable themes, keyframes, and CSS source tracing are follow-up work.

## Development

```sh
pnpm check:types
pnpm test
pnpm check
pnpm build
pnpm build:example
pnpm build:library
```

[Implementation phases](.agents/plan.md) · [Architecture](.agents/architecture.md) · [Token provenance](NOTICE.md) · [Agent conventions](AGENTS.md)
