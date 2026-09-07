# typestyle

A planned type-safe styling system with familiar CSS properties, inferred design tokens, and styles compiled ahead of time. The design targets compact CSS with readable class names and shared authoring across web and native.

Implementation starts from scratch. This repository currently contains the API design, phased implementation plan, and agent guidelines. No package API or CLI is implemented yet.

The proposed `Theme.define(tokens)` returns an inferred `css()` function. Colors accept a string or `{ light, dark }`. Typed variants, runtime variable bindings, and optional build integrations are specified in the architecture.

## Development

```sh
pnpm install
pnpm check
```

[Plan](.agents/plan.md) · [API and architecture](.agents/architecture.md) · [Agent guidelines](AGENTS.md)
