# Compatibility

This documentation describes the implemented web compiler and marks remaining API boundaries with scoped preview notes. The [implementation plan](../../.agents/plan.md) records remaining work and acceptance gates.

| Boundary                                   | Implemented scope                                                                                                     |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `style`, `Style.define`, and `Css.compile` | Static declarations, scalar bindings, conditions, queries, and ordered cascade                                        |
| `Theme` and `Config.create`                | Compatible themes, named selection, initialization scripts, property aliases, and dedicated spacing groups            |
| Source and packed linking                  | Configuration helpers, theme handles, ref relationships, variable contracts, and animation aliases                    |
| Stylesheets and adapters                   | Eager contributions, shared source maps, package-owned relative assets, optional reset, and rebuilds                  |
| Web frameworks                             | React, Solid, Svelte, HTML, and Next.js Webpack/Turbopack fixtures; see [web acceptance](../guides/web-acceptance.md) |

> [!NOTE]
> Arbitrary imported object records used as `style(record)`, inline Svelte authoring, Vue SFC integration, and universal native parity remain outside the verified web scope. The CLI and Next.js adapter are implemented; their acceptance evidence and limits are recorded separately.
>
> Inferred authoring types alone do not establish transform or rendering support. See the plan for each remaining acceptance gate.

Browser support depends on emitted CSS and selected processing targets. Explicit target processing belongs to adapters. Web integration evidence does not establish native rendering parity.

See [Literal Values](../api/core/Style/literals.md) for supported properties and [Platforms](../concepts.md#compilation-and-platforms) for target boundaries.
