# Compatibility

This documentation describes the implemented web compiler and marks remaining API boundaries with scoped preview notes. The [historical capability inventory](../../.agents/parity.md) records the earlier API comparison; the [Phase 2 plan](../../.agents/plan.md) records acceptance evidence and deferred gates.

| Boundary                                 | Implemented scope                                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `css`, `Style.define`, and `Css.compile` | Static declarations, scalar bindings, conditions, queries, and ordered cascade                                 |
| `Theme` and `Config.create`              | Compatible themes, named selection, initialization scripts, property aliases, and dedicated spacing groups     |
| Source and packed linking                | Configuration helpers, theme handles, style identities, variable contracts, and animation aliases              |
| Stylesheets and adapters                 | Eager contributions, shared source maps, package-owned relative assets, optional reset, and rebuilds           |
| Web frameworks                           | React, Solid, Svelte, and plain HTML integration fixtures; SSR/hydration and serialized-attribute checks in CI |

> [!NOTE]
> Arbitrary imported object records used as `css(record)`, the remaining variants and bundled-theme gates, Vue SFC integration, the CLI entrypoint, the Next.js adapter, and native compilation/rendering are still deferred. Inferred authoring types alone do not establish transform or rendering support. See the plan for each remaining acceptance gate.

Browser support depends on emitted CSS and selected processing targets. Explicit target processing belongs to adapters. Web integration evidence does not establish native rendering parity.

See [Literal Values](../api/core/Style/literals.md) for supported properties and [Platforms](../concepts.md#compilation-and-platforms) for target boundaries.
