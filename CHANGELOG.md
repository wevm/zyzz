# zyzz

## 0.0.22

### Patch Changes

- f57d4c3: Compact anonymous theme identifiers and isolate independent in-memory catalogs with matching token paths. Source-owned and explicitly identified themes retain their existing identifiers.
- 49bcaa3: Added native length calculations using configured variables and scalar callback inputs.
  
  ```ts
  import { style } from 'zyzz'
  
  const artwork = style((input: { aspectRatio: number }) => ({
    height: `calc(440px / ${input.aspectRatio})`,
    width: 'calc(180px * 2 + 80px)',
  }))
  
  artwork({ aspectRatio: 2 })
  ```
- 2103f17: Added automatic window subscriptions and responsive native styles and variable reads.
  
  ```ts
  import { defineConfig } from 'zyzz/react-native'
  
  const { Provider, style } = defineConfig({
    vars: { breakpoint: { md: '768px' } },
  })
  
  const panel = style({
    flexDirection: 'column',
    '@media md': { flexDirection: 'row' },
  })
  ```
- 2f86e22: Added native `defineConfig` with a typed `Provider` and `useVars(vars, selector?)`, and renamed `Provider.set` to `Provider.vars`.
  
  ```diff
  -import { defineConfig } from 'zyzz'
  -import { Provider } from 'zyzz/react-native/react'
  +import { defineConfig } from 'zyzz/react-native/react'
  
  -const { style, variants, vars } = defineConfig(options)
  +const { Provider, style, variants, vars } = defineConfig(options)
  
  -<Provider colorScheme="dark" set="blue">
  +<Provider colorScheme="dark" vars="blue">
     <App />
   </Provider>
  ```
- 9337bbd: Removed the combination limit from compiled native variants while preserving defaults, compound precedence, and typed inputs.
- 306123a: Added the `pageMarginSafety` page descriptor with validation for source and packed stylesheets.
- 79f5bb3: Removed compatibility aliases and legacy packed variable naming schemes, requiring older compiled libraries and standalone stylesheets to be rebuilt.
- aae8daa: Added selective native view updates for compiled styles, scoped Providers, and provider-free defaults in custom native builds.
- f57d4c3: Fixed shared native package compilation, composed token resolution, and font mapping delivery through Babel and Metro.
  
  ```ts
  import { zyzz } from 'zyzz/metro'
  
  export default zyzz(existingMetroConfig, {
    fonts: { 'Pilat, Arial, sans-serif': 'Pilat' },
    units: { px: 1, rem: 16 },
  })
  ```
- 8860e26: Listed the accepted token values in type errors for values outside a configured token domain, and limited completions on those properties to token names.
- c77f82f: Deduplicated theme variables and dependency styles in Vite development and production stylesheets.

## 0.0.21

### Patch Changes

- 1b60f79: Moved atomic media and supports conditions outside class rules to reduce inactive wrappers in browser DevTools.
- ab1da49: Replaced per-declaration CSS hashes with readable names, short module qualifiers, and consumer-owned namespaces.
- de21e04: Fixed explicit variable IDs to emit readable CSS names while preserving older packed libraries and standalone CSS artifacts.
- e2db8f6: Fixed repeated variable scopes in CSS-only Host builds.
- 64c0b72: Fixed Vite hot updates to refresh rewritten importers when style bindings change.

## 0.0.20

### Patch Changes

- 6a750b0: Fixed explicit configuration scopes to emit their complete variable catalogs during compilation.
- d3228c1: Added `Vars.compose` for CSS variable values containing live color, opacity, and length references.
  
  ```ts
  Vars.compose('spacing', ['calc(', core.number.space, ' * 1px)'])
  ```
- 220407e: Fixed portable inferred declarations for responsive references to composed variables.
- 29acaf6: Fixed inferred config declarations by exposing variable definition and reference types through `Config`.
- 725563c: Corrected returned styling props to omit explicitly undefined inline styles under exact optional property checking.
- 03c2f98: Fixed declaration generation for inferred variable aliases and configuration exports.
- 583a57c: Excluded Vite build configuration from stylesheet discovery and server-only modules from client scans.
- 0438675: Fixed composed length token compatibility and variant inference with large variable catalogs.
- e027a5f: Added external import patterns to standalone compilation and additional source directories to the Vite integration.
  
  ```ts
  await Host.create({ external: ['~icons/*'], packageId: 'vocs', root: 'src' })
  zyzz({ include: ['../library/src'] })
  ```

## 0.0.19

### Patch Changes

- 2ecccc2: Added `zyzz/oxlint` rules for style validation, logical properties, conflicting JSX props, unused namespace styles, and project property restrictions.
  
  ```ts
  export default {
    lint: {
      jsPlugins: [{ name: 'zyzz', specifier: 'zyzz/oxlint' }],
      rules: { 'zyzz/valid-styles': 'error' },
    },
  }
  ```

## 0.0.18

### Patch Changes

- 0748faf: Reduced repeated validation of frozen token references during style definition.
- 0748faf: Updated CSS conformance inventories to MDN data 2.36.0, including the upstream `scroll-axis-lock` grammar.

## 0.0.17

### Patch Changes

- c375cf8: Added typed support for inventoried CSS compatibility properties and automatic discovery of vendor prefixes and alternative names.
  
  ```ts
  style({
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
    rowRuleColor: 'repeat(2, red, blue)',
  })
  ```
- 932a500: Reduced type-checking work for theme shorthand declarations.
- 9cc95c4: Grouped compatible responsive fallback declarations across independently compiled Next.js consumers.
- 4bc5ee3: Preserved development stylesheet identities when imported dependencies changed.
- 932a500: Fixed development initialization scripts retaining removed configurations during concurrent Vite transforms.

## 0.0.16

### Patch Changes

- a2f1e9c: Consolidated generated theme rules and deduplicated shared theme declarations across Next.js modules.

## 0.0.15

### Patch Changes

- 278260d: Deduplicated responsive token defaults across web outputs and the Next.js reset, labeled generated tokens, and preserved variable selectors in Rollup bundles.

## 0.0.14

### Patch Changes

- 84b5f74: Fixed Next.js builds after restoring caches without generated stylesheets.

## 0.0.13

### Patch Changes

- dd17edd: Reduced Next.js rebuild dependencies by following named runtime exports through barrels.

## 0.0.12

### Patch Changes

- 213276a: Fixed CSS property and token autocomplete in variant declarations.

## 0.0.11

### Patch Changes

- 0df91d8: Replaced declaration helper `within` options with nested at-rule keys.
  
  ```ts
  import { fontFace } from 'zyzz/web'
  
  fontFace({
    '@layer base': {
      fontFamily: 'Body',
      src: 'url(/body.woff2)',
    },
  })
  ```
- 4bb3aa0: Fixed Webpack builds reading stale source contents during filesystem updates.

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
