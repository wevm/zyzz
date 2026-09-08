# Compatibility

This documentation describes the branch's implemented literal/scalar baseline (`9aa72fc`) and separately marked API designs. The [capability inventory](../../.agents/parity.md) tracks detailed CSS gaps.

| Boundary                          | Scope                                                |
| --------------------------------- | ---------------------------------------------------- |
| Root `css`                        | Literal source authoring requiring a transform       |
| `Style.define` and `Css.compile`  | Ordered literal data and scalar token references     |
| `Theme.define` and `Theme.extend` | Six scalar groups and compatible overrides           |
| `Source`, `Transform`, and `Host` | Literal extraction, rewriting, and filesystem builds |

> [!NOTE]
> Config linking, broad CSS, conditions, variants, CLI/plugins, and native output are previews. Inferred authoring types alone do not establish source-transform or rendering support.

Browser support depends on emitted CSS and selected processing targets. Explicit target processing belongs to adapters. React examples do not establish Vue/Svelte template compilation or native rendering parity; these need real integration coverage.

See [Literal Values](../api/core/Style/literals.md) for current properties and [Platforms](../concepts.md#compilation-and-platforms) for target boundaries.
