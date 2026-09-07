# typestyle

Type-safe styles compiled ahead of time. A small API, familiar CSS properties, built-in design tokens, and no production web styling runtime.

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
})
```

`css()` produces a class-name string and a stylesheet. Styles stay beside application code. Libraries can distribute compiled styles without requiring a compiler in consuming applications.

The current prototype supports literal style objects, typed tokens, responsive conditions, and light/dark palette values. Custom themes, a universal core, and native output are planned, not implemented.

The proposed theming API gives each theme shared tokens and complete light and dark color schemes. Web themes use CSS custom properties and `color-scheme`; native targets select precompiled scheme values.

## Development

```sh
pnpm install
pnpm build
pnpm dev
```

Run `pnpm check:types`, `pnpm test`, and `pnpm check` to verify changes. `pnpm build:library` builds the library example.

[Plan](.agents/plan.md) · [API and architecture](.agents/architecture.md) · [Agent guidelines](AGENTS.md)
