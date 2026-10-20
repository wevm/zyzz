# zyzz

## 0.0.35

### Patch Changes

- 38f75f4: Fixed invalid `typography` sets reducing the whole `style` or `variants` object type to `never`. The error now stays on the offending property and lists the accepted set names. Invalid shorthand alias tokens also list their accepted tokens.
- 56a745b: Added path removal to `Vars.extend`. `null` at an existing leaf or category removes it from the extension's references, `style` tokens, and emitted CSS. A removal of a missing path, or a `null` inside a leaf, throws `Vars.InvalidError`.
  
  ```ts
  const site = Vars.extend(
    base,
    { radius: { '3xl': null, '4xl': null }, shadow: null },
    { id: 'site/vars' },
  )
  ```

## 0.0.34

### Patch Changes

- 07f0d3f: Added `zyzz/compiler/wasm`, which compiles web source graphs in browsers and Cloudflare Workers without the native addon. `Graph.create` takes the `zyzz/compiler.wasm` module, compiled or as bytes, and its `compile` takes the web options of `Graph.compile` and returns the same output. Failures throw `Graph.CompileError` with the native error's name, message, and diagnostics.
  
  ```ts
  import { Graph } from 'zyzz/compiler/wasm'
  // Workers import a `.wasm` file as a compiled module
  import module from 'zyzz/compiler.wasm'
  
  // Links a consumer to a library contract without the native addon
  const output = Graph.create({ module }).compile({ contracts, imports, modules })
  ```
- d289c1e: Fixed Vite analysis of server-only protocol imports such as `cloudflare:workers` before TanStack Start removed them from client code. Resolvable protocol imports remained available for static style analysis, and unresolved ordinary file and package imports continued to report errors.

## 0.0.33

### Patch Changes

- c59662b: Shipped native compiler addons for macOS (arm64, x64), Windows (arm64, x64), and Linux glibc and musl (arm64, x64). Linux glibc addons now link against glibc 2.17, so they load on Amazon Linux 2023, RHEL 9, Debian 11, and Ubuntu 20.04. Other platforms still load the WebAssembly fallback.
- 56008a3: Fixed component import cycles through modules with runtime-only exports.
- 56008a3: Fixed route-local styles in TanStack split-route modules.

## 0.0.32

### Patch Changes

- 81561ac: Scoped the Vite plugin's discovery to the application's source. Discovery scans what `include` matches, otherwise the directories holding a `zyzz.config.*` module, otherwise the Vite root. The last two skip nested packages, such as a workspace's examples.
  
  `include` now accepts globs and files, and replaces the default scope instead of adding directories beside the Vite root. Imported modules still compile below the Vite root and `include` directories.
  
  ```ts
  // Scans the application's source and a linked package, which replaced `include: ['../library/src']`
  zyzz({ include: ['src/**', '../library/src'] })
  ```

## 0.0.31

### Patch Changes

- a20ecab: Fixed development HMR for server-rendered stylesheet links, which now update in the browser when a server-only module changes.

## 0.0.30

### Patch Changes

- e1aee01: Fixed `zyzz build --css-only` and other shared-stylesheet hosts failing on large graphs with `Failed to convert rust String into napi string`. Graph results no longer repeat the graph's token resources and scope rules in every module, so their size stays proportional to the source instead of the module count times the theme size.

## 0.0.29

### Patch Changes

- b5124eb: Moved the compiler to Rust. `Css.compile`, `Source.extract`, `Transform.compile`, `Native.compile`, and `Graph` run in a native addon with byte-identical output. Browser bundles that import `Css.compile` inline a WebAssembly build of the compiler.
- b5124eb: Omitted the module stylesheet import from Vite builds when the module emits no CSS, so a chunk without styled modules no longer links an empty stylesheet.

## 0.0.28

### Patch Changes

- 4c9609b: Fixed `cx` failing with `Composition requires statically known local style applications` when a selector interpolation or composition entry also read an applied definition, such as `${styles.row}:hover &` inside `namespace styles`. Template selector keys outside `selectors` now report that they require a selectors object at the key.
- cc75c18: Allowed `style` to compose earlier static definitions and literal objects from an array, such as `style([button, focusRing, { color: 'white' }])`. Entries compile in order into one definition with its own rules on web and native targets.
- 4c9609b: Accepted the Compat Standard `display` keywords `-webkit-box` and `-webkit-inline-box`, which `WebkitBoxOrient` and `WebkitLineClamp` require to truncate text after a number of lines.
  
  ```ts
  const excerpt = style({
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 3,
    overflow: 'hidden',
  })
  ```
- 4c9609b: Fixed `style` objects and arrays with an invalid declaration typing their definition as a dynamic style. TypeScript now reports only the invalid declaration instead of also reporting `Expected 1 arguments, but got 0` at every application.
- 6cd5ae9: Added `exclude` to the Vite plugin, leaving matching source modules out of discovery and transforms. Globs resolve against the Vite root, and regular expressions test absolute paths. Modules named `vite.config.*`, `vitest.config.*`, or `vitest.workspace.*` are always excluded, so discovery no longer compiles tool configuration.
  
  ```ts
  zyzz({ exclude: ['server.mjs', /\.stories\.tsx?$/] })
  ```
- b2a9655: Added `zyzz/runtime` to `optimizeDeps.include` in Vite development environments that discover dependencies and resolve the runtime inside `node_modules`. The first request for a compiled module no longer re-runs the dependency optimizer, which could leave server and browser modules with separate copies of a shared dependency such as React.
- 820ae5e: Marked the Vite plugin's development import resolves as scans, so the dependency optimizer no longer discovers packages that only compiler analysis reaches, and plugins can tell that analysis apart from module graph imports.
- 0945de4: Reused import resolutions and derived package contracts across Vite module transforms until the watcher reports a change, so each module no longer resolves the whole discovered project again.

## 0.0.27

### Patch Changes

- b7b7f67: Stopped emitting variable declarations that only forward a base set's variable, unless another set with the same identity overrides the path.
- b7b7f67: Shortened responsive fallback variable names to a hash of their CSS, shrinking emitted stylesheets with responsive variables.

## 0.0.26

### Patch Changes

- 5ffdde5: Allowed `extendVars` to add variables and derived values, name a new linked set with `id`, and keep sibling extensions distinct in emitted CSS.
- 866f37c: Fixed Vite failing to load relative font and image URLs from packed contracts installed under scoped or pnpm paths containing `@` or `+`.

## 0.0.25

### Patch Changes

- c521550: Accepted references from the `vars` returned by `Config.create` in `Vars.define` and `Vars.extend` values, resolving them to the configured variables.
- c521550: Derived missing package contracts from published JavaScript when a package depends on Zyzz, while shipped `.zyzz.json` contracts still take precedence.
- e48b6fe: Removed repeated class lists from local definitions whose applications all fold, and folded top-level reads after a definition without initialization guards.
- e48b6fe: Added `composition` to `defineConfig`, so independent atomic styles share one short-named rule per repeated declaration across modules.
  
  ```ts
  export const { style } = defineConfig({ composition: 'independent' })
  ```
- c521550: Fixed Next.js builds failing to resolve packed font and image assets installed under scoped or pnpm paths containing `@` or `+`.
- 6953bf4: Fixed compiled modules keeping `defineConfig`, `defineVars`, and `extendVars` imports from `zyzz` after the compiler replaced every call.
- e48b6fe: Shared atomic rules in production builds between local styles applied only alone to DOM elements or inside `cx`, and between consecutive ordered styles with equal declarations.

## 0.0.24

### Patch Changes

- b174e48: Fixed `defineConfig` scanning every CSS property for each variable token when no `mappings` are configured, which slowed module evaluation for large token sets.
- b174e48: Fixed React Native views committing their shadow tree on every mount and re-render by attaching native style bindings only when a Provider change first patches them.
- 9ee8432: Improved React Native startup by building `defineConfig` authoring helpers on first runtime use, since compiled styles and `useVars` read precompiled tables.
- 9ee8432: Fixed React Native views committing the shadow tree once per styled view when unmounting or re-rendering after a theme change, which took seconds for 1,000 views.
- 9ee8432: Improved React Native re-renders by skipping binding refs for styles that never change and removing per-render layout effects from compiled components.
- 9ee8432: Added `colorScheme="system"` to the native Provider, following the device appearance and switching color-only scheme differences on iOS through dynamic colors without updates.
  
  ```tsx
  <Provider colorScheme="system">{children}</Provider>
  ```
- 9ee8432: Improved React Native theme switches by binding views inside the update batch, converting each shared style once, and skipping overlay reapplication during zyzz's own patch commit.
- 18cc713: Fixed repeated color-scheme rules in complete stylesheets from Host builds and the esbuild, Rollup, and webpack plugins.
- 0c34bf1: Fixed `variants` inference failing on inline dynamic choice callbacks when `defaultVariants` precedes `variants` in the recipe definition.

## 0.0.23

### Patch Changes

- b29016b: Fixed theme references in `!custom` compound templates such as `boxShadow`, which failed extraction and now resolve per native set and scheme.
  
  ```ts
  style({ boxShadow: `0px 2px 24px ${vars.color.shadow} !custom` })
  ```
- b29016b: Expanded the CSS `flex` shorthand into native `flexGrow`, `flexShrink`, and `flexBasis` with CSS defaults instead of rejecting it.
  
  ```ts
  style({ flex: 1 }) // flexGrow 1, flexShrink 1, flexBasis 0
  ```
- b29016b: Expanded `inset` into native `top`, `right`, `bottom`, and `left` offsets with one-to-four-value CSS semantics.
- b29016b: Made `useStyles` resolver results assignable to React Native style props, and preserved animated ref unions and generic function signatures in `withStyles` wrappers.
- b29016b: Resolved compiled styles in JSX props ending in `Style`, such as `contentContainerStyle`, inside function components and custom hooks without `withStyles`.
- b29016b: Fixed `useStyles` and `withStyles` throwing outside a Provider, including Metro-compiled third-party style props in the component that renders the Provider.
- b29016b: Fixed style callbacks rejecting `aspectRatio` bindings from positive numeric literal unions, such as `values: { ratio: 1 | 1.5 }`, during compilation.
- b29016b: Deduplicated compiled `useVars` profiles in Metro and Babel native builds to one export per variable definition, including `defineConfig` modules outside the project root.

## 0.0.22

### Patch Changes

- f57d4c3: Compact anonymous theme identifiers and isolate independent in-memory catalogs with matching token paths. Source-owned and explicitly identified themes retain their existing identifiers.
- 6bb5414: Allowed functions to read `variable()` references declared later in the module.
  
  ```ts
  import { style, variable } from 'zyzz'
  
  export const plan = (accent: string) =>
    styles.plan({ vars: { [variables.accent]: accent } })
  
  namespace variables {
    export const accent = variable('color')
  }
  
  namespace styles {
    export const plan = style({ color: variables.accent })
  }
  ```
- d0473fc: Added `withStyles` and optional Reanimated hooks for Provider-selected variables and applied numeric or color properties.
  
  ```ts
  import { withStyles } from 'zyzz/react-native'
  import { useAnimatedVars } from 'zyzz/react-native/reanimated'
  
  const StyledCard = withStyles(Card, { styleProps: ['bodyStyle'] })
  
  function useBackground() {
    return useAnimatedVars(vars, (values) => values.color.background)
  }
  ```
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
  +import { defineConfig } from 'zyzz/react-native'
  
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
