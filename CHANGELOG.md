# zyzz

## 0.0.10

### Patch Changes

- b640c31: Aligned token mappings and fallback precedence with Tailwind.

## 0.0.9

### Patch Changes

- c0c8433: Replaced bracketed arbitrary values with the `!custom` suffix.
  
  ```ts
  style({ padding: '7px !custom', color: 'red !custom !important' })
  ```
- 84d4bde: Fixed stale Vite initialization scripts when background transforms overlapped document requests.
- 7fdef92: Reused Vite compilation and source reads across modules, skipped JavaScript HMR for CSS-only edits, and cleared styles from deleted modules.

## 0.0.8

### Patch Changes

- d8089fd: Reused source snapshots and parsed syntax across Vite, Metro, portable bundler adapters, and CLI builds, and retained incremental Metro compilation state.
- 0a8dfab: Reduced Next.js cold compilation and incremental work with dependency-scoped graphs, bounded compiler caches, and native CSS hot updates for server components.

## 0.0.7

### Patch Changes

- 38b59a0: Reused incremental project graphs, parsed modules, and filesystem snapshots across Next.js loader calls.
- 7cb35f7: Required configured tokens by default and added bracketed strings for arbitrary CSS values.
  
  ```ts
  const { style } = Config.create({ vars: { spacing: { md: '8px' } } })
  style({ padding: 'md', marginTop: '[7px]' })
  ```

## 0.0.6

### Patch Changes

- 513ab36: Added opt-in `reset: true` support to web plugins.
- d6fc653: Fixed missing Next.js shared styles when client instrumentation is present.
- 35e72ff: Added static token values in stylesheet contributions and package font URL resolution in Vite.
  
  ```ts
  import { global } from 'zyzz/web'
  
  const tokens = { fontFamily: { sans: 'Geist' } }
  
  global({ body: { fontFamily: tokens.fontFamily.sans } })
  ```

## 0.0.5

### Patch Changes

- 0448373: Fixed default layers for native-only styles and froze synthesized layer rules.
- 6d5fb05: Added support for variable scope applications in `cx` compositions.
  
  ```tsx
  <html {...cx(vars(), styles.root())} />
  ```
- 0d61d9f: Fixed breakpoint aliases in responsive variable fallbacks and stylesheet delivery for loader-generated Next.js modules.
- 817eb8e: Fixed Next.js loader graph discovery for virtual `next/root-params` imports.
- 0d61d9f: Fixed shared style class ownership across successive cross-module compositions.

## 0.0.4

### Patch Changes

- 9514cae: Fixed theme color references in compound CSS, custom properties, and important declarations.
- d739d3d: Fixed browser style discovery in projects with Node.js imports.
- 7a883dd: Added `Config.create({ defaultLayer })` to place styles and variants in a fallback CSS layer while preserving explicit layer blocks.
  
  ```ts
  const { style, variants } = Config.create({
    defaultLayer: 'components',
    layers: ['components', 'overrides'],
  })
  ```
- a607d2b: Added a derived-values callback to `Vars.define` with deep merging and live references across variable-set overrides.
  
  ```ts
  const vars = Vars.define({ color: { ink: '#171717' } }, (vars) => ({
    color: { foreground: vars.color.ink },
  }))
  ```
- 5e27572: Aligned all default color palettes with Geist's sRGB light and dark colors.
- a3e521b: Added full variable paths in compatible CSS properties with `mappings: false`.
  
  ```ts
  const { style } = Config.create({
    vars: { surface: { foreground: '#123456' } },
    mappings: false,
  })
  const text = style({ color: 'surface.foreground' })
  ```
- 6b09256: Fixed callable style overrides to accept React's `CSSProperties`.
- 8b9a7c1: Fixed Vite stylesheet requests with CSS query parameters.
- 6270888: Added border-width tokens and responsive typography sets with media and container queries.
  
  ```ts
  import { Config } from 'zyzz'
  
  const { style } = Config.create({
    vars: {
      borderWidth: { regular: '1px' },
      breakpoints: { tablet: '48rem' },
      typography: {
        heading: {
          fontSize: '24px',
          '@media >=tablet': { fontSize: '40px' },
        },
      },
    },
  })
  const title = style({ typography: 'heading', borderWidth: 'regular' })
  ```
- f6ff0de: Fixed selector and at-rule key suggestions and nested property and value autocomplete in root and configured styles.
- d74c04b: Added typography token autocomplete to configured style helpers.
- 448d20a: Added unplugin adapters for Rollup, Webpack, and esbuild with shared CSS output and access to the existing Vite integration.
  
  ```ts
  import { zyzz } from 'zyzz/esbuild'
  
  const plugins = [zyzz()]
  ```
- f82020d: Replaced theme APIs with `Vars`, configurable variable sets, callable `vars` references and scope selection, and `vars` assignments.
  
  ```diff
  -import { Theme, Config } from 'zyzz'
  -const base = Theme.define({ color: { accent: '#2563eb' } })
  -const { theme, themes } = Config.create({ themes: { base }, defaultTheme: 'base' })
  -theme.tokens.color.accent
  -themes({ theme: 'base', colorScheme: 'dark' })
  -style({ variables: { [accent]: 'tomato' } })
  -label({ variables: { [accent]: 'blue' } })
  +import { Vars, Config } from 'zyzz'
  +const base = Vars.define({ color: { accent: '#2563eb' } })
  +const { vars } = Config.create({ vars: { base }, defaultVars: 'base' })
  +vars.color.accent
  +vars({ set: 'base', colorScheme: 'dark' })
  +style({ vars: { [accent]: 'tomato' } })
  +label({ vars: { [accent]: 'blue' } })
  ```
- 8e04e2c: Fixed stale Webpack source reads when watched directories changed.

## 0.0.3

### Patch Changes

- 0c6c948: Added nested typography theme sets to `zyzz/default`.
  
  ```ts
  import { style } from 'zyzz/default'
  
  namespace styles {
    export const title = style({ typography: 'heading.32' })
    export const code = style({ typography: 'label.14.mono' })
  }
  ```

## 0.0.2

### Patch Changes

- 2d051ce: Restricted important values to the `<value> !important` syntax in types and runtime validation.
- 634da64: Replaced `zyzz/themes/default` with `zyzz/default`, exporting the bundled configuration's appearance controls, initialization script, theme, authoring helpers, and raw tokens.
  
  ```ts
  import {
    appearance,
    script,
    style,
    theme,
    tokens,
    variants,
  } from 'zyzz/default'
  ```
- 3fd7de0: Fixed CSS value and theme token autocomplete for config-bound styles.
- 5b598c9: Improved style property and value suggestions, error locations, and type-checking performance.
- 78bcb37: Added `Props.Variants` to infer variant selections and styling overrides from a recipe.
  
  ```ts
  import type { Props } from 'zyzz'
  
  type ButtonProps = Props.Variants<typeof styles.button>
  ```

## 0.0.1

### Patch Changes

- 0a928f8: Initial release
