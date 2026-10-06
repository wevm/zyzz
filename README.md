<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/logo-dark.svg">
    <img alt="zyzz" src=".github/assets/logo-light.svg" width="170" height="76">
  </picture>
</p>

<p align="center">
  Modern, universal, simple styling library for the Web and React Native
</p>

<p align="center">
  <a href="#overview">Overview</a> · <a href="#philosophy">Philosophy</a> · <a href="#features">Features</a> · <a href="#documentation">Documentation</a> · <a href="https://zyzz.sh/docs/guides/styling">Guides</a> · <a href="https://zyzz.sh/docs/api/core">API Reference</a>
</p>

## Overview

```tsx
import { style } from 'zyzz'

namespace styles {
  export const button = style({ color: '#06c', padding: '1rem' })

  export const card = style({ display: 'grid', gap: '1rem', padding: '1.5rem' })
}

export function Card() {
  return (
    <article {...styles.card()}>
      <h2>Get started</h2>
      <button {...styles.button()}>Continue</button>
    </article>
  )
}
```

## Philosophy

- **Typed.** Properties, tokens, and variants carry their constraints into every call.
- **Standard.** Styles use familiar CSS properties, selectors, queries, and cascade behavior.
- **Agnostic.** The core is independent of frameworks, build tools, and environments.
- **Universal.** Shared definitions target web and native with explicit platform capabilities.
- **Minimal.** Small, composable APIs keep configuration and dependencies optional.
- **Compiled.** Rules compile ahead of time into compact output with readable class names on web.

Read [Thinking in Zyzz](https://zyzz.sh/docs/introduction/thinking-in-zyzz) for co-location, composition, and styling conventions.

## Features

- [**Typed Styles**](https://zyzz.sh/docs/guides/styling): familiar CSS with property and value inference, inline or reusable.
- [**Themes**](https://zyzz.sh/docs/guides/themes): inferred design tokens, optional defaults, and compatible overrides.
- [**Token Values**](https://zyzz.sh/docs/api/core/defineConfig#token-values): configured tokens by default, with the `!custom` suffix for arbitrary CSS.
- [**Color Schemes (Light/Dark Mode)**](https://zyzz.sh/docs/guides/themes#apply-a-theme): light/dark token pairs selected by CSS, without a preference listener.
- [**Variants**](https://zyzz.sh/docs/guides/variants): typed component choices, defaults, and compound rules.
- [**Dynamic Styles**](https://zyzz.sh/docs/guides/styling#bind-dynamic-values): runtime values bound to static CSS through custom properties.
- [**Value Syntax**](https://zyzz.sh/docs/api/core/values): importance, ordered fallbacks, and typed token and variable references.
- [**Composition**](https://zyzz.sh/docs/guides/styling#combine-styles): explicit style overrides that retain bindings and variant attributes.
- [**Static CSS**](https://zyzz.sh/docs/guides/css-output): ahead-of-time output with readable classes and no runtime rule generation.

## Documentation

Head to the [documentation](https://zyzz.sh/docs) to get started and learn more about Zyzz.

## Benchmarks

See [Benchmarks](https://zyzz.sh/docs/introduction/benchmarks) for measured compilation, runtime, and output-size comparisons.

## Comparison

See [the comparison](https://zyzz.sh/docs/introduction/comparisons) for examples covering authoring, developer and agent experience, compilation, performance, and bundle size.
