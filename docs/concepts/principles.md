# Principles

- **Agnostic:** pure contracts do not depend on a framework, host, or bundler.
- **Compiled:** rules exist before rendering; runtime work selects or binds values.
- **Minimal:** core imports include no theme, reset, registry, or provider.
- **Modular:** explicit inputs and narrow adapters separate responsibilities.
- **Standard:** CSS properties, custom properties, selectors, and cascade retain their meaning.
- **Typed:** values carry constraints through definitions, imports, and applications.
- **Universal:** shared authoring targets explicit web/native capabilities.

```ts
import { css } from 'zyzz'

const card = css({ padding: '1rem' })
```

The [compilation model](compilation.md) explains which boundaries are shared and which belong to platform adapters.
