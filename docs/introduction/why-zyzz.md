# Why Zyzz

Zyzz puts styling constraints into small, explicit APIs that developers and agents can inspect together.

- **Agnostic:** the pure core is independent of frameworks and build tools.
- **Compiled:** rules are emitted ahead of time; runtime values bind to existing rules.
- **Minimal:** core imports contain no design tokens or mandatory provider.
- **Standard:** properties, selectors, variables, and cascade behavior follow CSS.
- **Typed:** properties, theme paths, and variants retain inference.

```ts
import { css } from 'zyzz'

const styles = {
  card: css({ padding: '1rem' }),
}
```

Static compilation imposes constraints: rule structure must be analyzable, source authoring needs a transform, and native cannot reproduce every web feature. See [Compatibility](compatibility.md) and measured [Benchmarks](benchmarks.md).
