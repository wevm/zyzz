# Implementation plan

This plan tracks remaining implementation and acceptance work for Zyzz contributors. The goal is shared, typed web/native authoring with ahead-of-time output and ordinary platform components.

Native follow-up based on `main` at [`1e0fc5e`](https://github.com/wevm/zyzz/commit/1e0fc5e) on September 17, 2026. The [graph](https://github.com/wevm/zyzz/pull/198), [file-host](https://github.com/wevm/zyzz/pull/199), and [packed callable](https://github.com/wevm/zyzz/pull/200) changes are in review.

The web acceptance stack, typed target branches, and static native values are merged. The web [local evidence and limits](../docs/guides/web-acceptance.md) remain separate from hosted CI, native parity, at-rule rendering, and release measurements.

## Current status

| Area                         | Status                                                                                                                                                                                                                                                 | Evidence                                                                                                                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core and web authoring       | Implemented: definitions, themes, variables, dynamic bindings, selectors, contributions, source compilation, and packed contracts.                                                                                                                     | [Public API](../docs/api/README.md)                                                                                                                                                                                                         |
| CSS properties               | All 670 pinned properties are marked supported under the static authoring contract. Other syntax families and rendering have separate coverage.                                                                                                        | [Coverage ledger](../test/conformance/coverage.json), [conformance workflow](../test/conformance/README.md)                                                                                                                                 |
| At-rules                     | Compiler obligations and target reviews are recorded for the complete inventory. Rendering acceptance remains open.                                                                                                                                    | [Acceptance review](../test/conformance/at-rule-acceptance.md), [matrix](../test/conformance/at-rule-matrix.json)                                                                                                                           |
| Web variants and composition | Implemented, including packed and framework fixtures.                                                                                                                                                                                                  | [#145](https://github.com/wevm/zyzz/pull/145), [#146](https://github.com/wevm/zyzz/pull/146)                                                                                                                                                |
| CSS output and pruning       | Both output modes, module isolation, composition, and conservative local pruning have passing local acceptance. Whole-program pruning remains unimplemented.                                                                                           | [CSS output guide](../docs/guides/css-output.md), [#172](https://github.com/wevm/zyzz/pull/172), [transform fixtures](../src/compiler/Transform.test.ts)                                                                                    |
| Integrations                 | CLI, Vite, Next.js Webpack/Turbopack, React, Solid, Svelte, and HTML have passing local fixtures, including SSR and lifecycle coverage within their documented scope.                                                                                  | [Web acceptance record](../docs/guides/web-acceptance.md), [framework fixtures](../test/fixtures/Framework.ts), [Next.js fixtures](../src/next/index.test.ts)                                                                               |
| Native foundation            | Static tables, target branches, structured native values, theme/scheme lookup, composition, flattening, and helpers are implemented. Native graph, file-host, and packed static callable output have local acceptance. Device acceptance remains open. | [#173](https://github.com/wevm/zyzz/pull/173), [#174](https://github.com/wevm/zyzz/pull/174), [#175](https://github.com/wevm/zyzz/pull/175), [#176](https://github.com/wevm/zyzz/pull/176), [StyleSheet](../src/react-native/StyleSheet.ts) |

## Next work

1. Validate the native graph, file-host, and packed-callable stack against hosted CI. Local source-free package acceptance covers browser output, native execution, and consumer declarations.
2. Audit remaining 3.8f integration limits, including CLI/bundler routing and packed namespace import forms, before closing universal source-compilation acceptance.
3. Complete dynamic/host interoperability, independent iOS/Android evidence, and the universal parity gate. Keep remaining web rendering gaps visible throughout this work.
4. Finish distribution, measurement, and documentation acceptance before release.

Keep the existing sequence labels for native dependencies. Older phase ordering does not undo merged work or close an unresolved gate.

## Web acceptance

### Completed local acceptance

Both output modes cover cascade ordering, deduplication, composition, stale-binding removal, and conservative local reachability. React, Solid, Svelte, HTML, CLI, Vite, and Next.js Webpack/Turbopack fixtures cover their documented consumer, delivery, SSR, and lifecycle contracts. The [acceptance record](../docs/guides/web-acceptance.md) owns fixture mappings, versions, reproduction, and limits.

Merged follow-ups cover [module isolation and HTML delivery](https://github.com/wevm/zyzz/pull/181), [server serialization](https://github.com/wevm/zyzz/pull/183), [Next.js configuration lifecycle](https://github.com/wevm/zyzz/pull/184), and [Vite startup-event handling](https://github.com/wevm/zyzz/pull/185). Whole-program pruning, inline Svelte authoring, and additional application frameworks remain outside this verified scope. Examples alone do not establish framework acceptance.

[Compile/watch/render and delivery measurements](../bench/Web-acceptance.md) are recorded for repeated, unique, conditional, and override-heavy workloads. These diagnostic results do not close the release measurement gates below.

- [ ] Confirm hosted checks on merged `main` at `98ce806`. [Main](https://github.com/wevm/zyzz/actions/runs/35161922329), [Benchmarks](https://github.com/wevm/zyzz/actions/runs/35161922059), and [Examples](https://github.com/wevm/zyzz/actions/runs/35161922053) were queued at reconciliation. Local checks do not establish hosted success.

### Remaining authoring and lifecycle audit

These items combine earlier open checklists. Existing implementation must be checked against named public fixtures before adding work or closing an item.

- [ ] Complete dynamic binding, theme/scheme inheritance, bundled-helper aliases, packed exports, and root-initialization acceptance. Preserve fixed rule counts, consumed-input removal, explicit variable ownership, and SSR identity.
- [ ] Resolve imported arbitrary static records, generic/imported callback types, dynamic fallback groups, standalone variable destructuring, and optional `ClassName<Properties>` contracts.
- [ ] Cover relational selectors, specificity, repeated/nested references, state combinations, pseudo-elements, accessibility/device/print conditions, container selection, and starting-style behavior.
- [ ] Complete keyframe/animation, reduced-motion, layer-order/cycle, contribution-ownership, font/asset, and packed/plain-CSS acceptance. Verify independent stylesheet loading order and document external-name and contract-only interoperability limits.

### Full at-rule support

The pinned inventory contains 22 rules and 62 descriptor/nested entries. Compiler support, target compatibility, and rendered behavior are separate claims. Detailed obligations belong in the [matrix](../test/conformance/at-rule-matrix.json), not a second checklist here.

- [ ] Close relative ICC color, rendering-intent, fragmentation, and remaining renderer gaps with independent screen/PDF controls.
- [ ] Keep experimental, legacy, and unsupported target behavior explicit. Emitted syntax or parser acceptance does not prove rendered support.
- [ ] Reconcile compiler, target, rendering, and legacy combined gates without deleting inventory entries or treating unsupported output as verified.

## Universal web and React Native parity

The accepted scope is the union of web and native capabilities, with one authoring/application model. It is not limited to portable scalar styles. Shared declarations retain documented meanings. Typed target branches handle platform-specific values. Nonportable unqualified declarations must produce diagnostics.

The [universal contract](../docs/api/react-native/universal.md) specifies target resolution and value semantics. The [pinned inventory](../test/conformance/native/inventory.json) records React Native 0.87.0, 387 component/property pairs, and six runtime StyleSheet APIs. Inventory coverage does not establish value-domain or renderer parity.

| Order | Remaining work                                                | Completion                                                                                                                                 |
| ----- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 3.8e  | Hosted acceptance for static native variants and composition. | Shared inference, defaults, nulls, compounds, ordering, and bounded tables.                                                                |
| 3.8f  | Universal callable source compilation and packed exports.     | The same authoring modules and application inputs compile for web/native without duplicate definitions.                                    |
| 3.9a  | Dynamic/animated interoperability and host capabilities.      | Correct updates, cleanup, opaque device values, preprocessing, hairline widths, and explicit scheme/platform/density/accessibility inputs. |
| 3.9b  | Independent browser/iOS/Android conformance and measurements. | Every applicable inventory entry has type, runtime, and renderer evidence against independent platform controls.                           |
| 3.10  | Enforce full parity.                                          | No missing, partial, deferred, or untested native capability. All applicable gates pass.                                                   |

Static variants now retain target-neutral rules and compile bounded theme/scheme tables. [Local callable compilation](../docs/api/compiler/Native.md) preserves finite selection inputs and native composition, with [integration evidence](../src/compiler/Native.test.ts). Imported graphs, file-host rebuilds, and packed static callables have [local consumer evidence](../docs/guides/native-acceptance.md). Dynamic host updates, CLI/bundler routing, packed namespace imports, and device rendering remain open.

3.8d is implemented: [typed target branches](https://github.com/wevm/zyzz/pull/192) and [static native values](https://github.com/wevm/zyzz/pull/193), including transforms, matrices, colors, fonts, and shadows. The [static audit](../test/conformance/native/README.md) covers 157 properties across 421 component pairs, with [compiler](../src/react-native/StyleSheet.test.ts) and [type](../src/react-native/StyleSheet.test-d.ts) evidence. Host interoperability and device rendering remain 3.9 work.

Completion requirements:

- Preserve the full pinned denominator, including experimental/deprecated APIs and imported value domains. Version upgrades require an inventory diff.
- Cover inherited View/Text/Image properties, legal structured values, units, flex, RTL, font scaling, transforms, colors, and override precedence. Type outputs against actual React Native component contracts.
- Preserve ordinary native objects, nested arrays, falsy entries, shallow replacement, and identity behavior. Do not serialize or freeze host-owned animated/color objects. Host registration stays outside core.
- Compile shared and packed definitions for browser, iOS, and Android. Verify themes, schemes, variants, dynamic payloads, composition, and target overrides without runtime CSS generation or unbounded table multiplication.
- Pin platform/OS versions, renderer architecture, fonts, density, and visual tolerances. Compare real native layout/rendering with independent React Native controls. QuickJS and compiler snapshots do not replace device execution.
- Keep existing web coverage. Only evidenced upstream platform unavailability may be marked not applicable. `check:native:full` remains incomplete until executed evidence replaces its pending guard.

## Distribution and measurements

### Remaining delivery work

- [ ] Verify independent web/native packages, declarations, CSS/static tables, namespace isolation, contribution metadata, and final asset processing. Root imports must exclude bundled themes, target adapters, parsers, and build tools.
- [ ] Add shared Browserslist target configuration and a CLI `--targets` option. Lightning CSS processing already exists in the host. Preserve consuming-build ownership, cache identities, maps, and default modern CSS.
- [ ] Complete downlevel theme/scheme checks, including inherited, forced, inline, and external scopes. Diagnose transformations that cannot preserve semantics.
- [ ] Review public APIs/dependencies, package metadata, and the release workflow against the project principles.

### Remaining measurement work

Literal/theme compiler comparisons and production React variant/render workloads exist. [Benchmark instructions](../bench/README.md) define reproduction and measurement boundaries. [Variant measurements](../bench/Web-variants.md) retain recorded results and losses.

- [ ] Complete cold/warm source builds, incremental edits, dependency changes, and opt-in sweeps from 10 to 10,000 styles. Vary authored styles and rendered instances independently.
- [ ] Cover complex themes, queries, relational styles, animations, override-heavy composition, deep/wide trees, and dynamic updates using real framework runtimes.
- [ ] Add SSR/hydration, route splitting, packed-library delivery, browser recalculation/layout/paint, and native compilation/table/lookup/binding measurements.
- [ ] Confirm repeatability before adding render timing regression gates. Keep the existing Panda CSS, StyleX, Tailwind, vanilla-extract, and baseline comparisons, workloads, and thresholds. Report losses and uncertainty from matched sequential runs.

The performance target remains leading applicable matched workloads in build time and complete CSS/required-JavaScript delivery. Report raw/gzip/Brotli, markup, and helper costs without double-counting. A noisy ranking or a compiler microbenchmark does not establish application performance. The compiler optimization in [#179](https://github.com/wevm/zyzz/pull/179) does not close this broader gate.

## Documentation and deferred work

- [ ] Keep API references, errors, examples, and compatibility claims aligned with exports and executed consumer fixtures. Remove preview notes only when the relevant acceptance passes.
- [ ] Finish framework, SSR, migration, and native guides alongside implementation. Keep compatibility claims tied to the conformance ledgers.
- [ ] Specify semantic token aliases, dependency cycles, conditional tokens, remaining token groups, and override semantics before implementation. Evaluate named presets, token-only enforcement, and documentation export after core acceptance.

Later framework fixtures include Nuxt, SvelteKit, SolidStart, Astro, TanStack Start, and Preact. Angular and Qwik remain later work. Remix 3 and React Router are deferred. Existing examples do not close these gates.

Scoped view-transition names, anchors, timelines, and emerging CSS values retain separate acceptance from at-rules. Browser API orchestration stays outside the compiler. Slot systems, general utility registries, additional comparison libraries, and advanced optimizer research remain outside scheduled MVP work.

## Maintaining this plan

Keep this file to current status, remaining work, and completion criteria. Put API contracts in the [API reference](../docs/api/README.md), usage in [docs](../docs/README.md), conformance evidence in its ledger, and measurements in benchmark reports. Follow the documentation and verification conventions in [AGENTS.md](../AGENTS.md).

When closing work, link the implementation and passing evidence at an identified commit. Merge status alone does not close acceptance. Historical PR sequences and measurements remain available in the [previous plan](https://github.com/wevm/zyzz/blob/e53d654/.agents/plan.md).
