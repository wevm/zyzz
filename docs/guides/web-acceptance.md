# Web acceptance

This record helps contributors distinguish verified web behavior from remaining release work. Local checks started from `a4585e3`, the head of [#181](https://github.com/wevm/zyzz/pull/181) after [#182](https://github.com/wevm/zyzz/pull/182) merged into it, on September 16, 2026.

## Coverage

| Boundary             | Evidence                                                                                                              | Scope                                                                                                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CSS output           | [CSS tests](../../src/web/Css.test.ts)                                                                                | Both modes, shorthand resets, logical overlap, `all`, repeated overrides, fallback/importance, conditions, layers, and module identities. Browser controls establish cascade behavior.               |
| Composition          | [Composition tests](../../src/cx.test.ts), [runtime props](../../src/runtime/Props.test.ts)                           | Static/dynamic composition, conditional selections, payload ownership, and stale-binding removal.                                                                                                    |
| Reachability         | [Transform reachability cases](../../src/compiler/Transform.test.ts), [graph tests](../../src/compiler/Graph.test.ts) | Unused local definitions are pruned; exports, escaped definitions, referenced identities, variant alternatives, and complete live theme scopes remain retained.                                      |
| HTML and React SSR   | [HTML runtime tests](../../src/runtime/Html.test.ts), [#183](https://github.com/wevm/zyzz/pull/183)                   | Node serializes initial attributes; Chromium verifies escaping, hydration, node identity, updates, override cleanup, and unchanged rule counts in both modes.                                        |
| React, Solid, Svelte | [Framework fixture](../../test/fixtures/Framework.ts)                                                                 | Both modes, consumer types, SSR/hydration, packed variants, themes, updates, maps, failed-edit recovery, mode changes, relocation, and cleanup. Svelte definitions stay in TypeScript modules.       |
| HTML delivery        | [Vite tests](../../src/vite/index.test.ts)                                                                            | Lazy production delivery, repeated loads, DOM preservation, dependency edits, and document-scoped initialization.                                                                                    |
| Next.js              | [Next fixture](../../test/fixtures/Next.ts), [#184](https://github.com/wevm/zyzz/pull/184)                            | Webpack/Turbopack in both modes; packed consumers, server/client components, hydration identity, streaming, navigation, maps, assets, refresh, configuration-mode changes, relocation, and recovery. |
| CLI and ownership    | [CLI tests](../../src/cli/index.test.ts), [host tests](../../src/node/Host.test.ts)                                   | Packed commands in both modes, CSS-only output, explicit IDs, watch additions/renames/deletions, failure preservation, maps, and owned-output cleanup.                                               |

## Reproduction

Install locked dependencies and build with `pnpm install --frozen-lockfile` and `pnpm build`. Install Chromium with `pnpm exec playwright install chromium`.

Run the functional acceptance suites:

```sh
pnpm exec vp test run src/web/Css.test.ts src/compiler/Graph.test.ts src/cx.test.ts src/runtime/Props.test.ts src/runtime/Html.test.ts src/node/Host.test.ts src/cli/index.test.ts src/vite/index.test.ts src/vite/React.test.ts src/vite/Solid.test.ts src/vite/Svelte.test.ts src/next/index.test.ts --no-file-parallelism --coverage
pnpm exec vp test run src/compiler/Transform.test.ts -t reachability
```

Local environment: macOS, Node 25.9.0, pnpm 11.19.0, Vite 8.2.2, Chromium 153.0.8010.12. Framework fixtures pin their versions: Next.js 16.3.5 with React 19.2.4, Solid 1.9.9, and Svelte 5.46.4. Check each fixture for the complete dependency set.

## Local results

The combined run passed 241 of 242 tests and exposed a startup-event race in the Vite fixture. After correction, all 17 Vite cases passed with coverage and again independently. The other 225 cases passed in the combined run; all 13 reachability cases passed separately.

V8 recorded 73.13% statements, 69.64% branches, 77.23% functions, and 74.78% lines during the combined run. These are diagnostics for the selected suites, not full-product coverage. Subprocess and separately bundled browser code do not contribute equivalent host-process coverage.

Compiler, watcher, and production render diagnostics are recorded in [Web acceptance measurements](../../bench/Web-acceptance.md). All 16 compiler/theme benchmark checks and all 72 production render groups passed. The measurements cover the existing workload matrix and retain its limitations.

## Limits

- Local results do not establish hosted CI status or support for every browser and operating system.
- Whole-program and transitive dead-reference pruning remain unimplemented. Do not infer them from local reachability checks.
- Inline Svelte authoring, additional application frameworks, and the broader authoring backlog remain separate work.
- Full at-rule rendering, native parity, and matched compile/watch/render measurements remain separate gates. Follow the [plan](../../.agents/plan.md), [at-rule matrix](../../test/conformance/at-rule-matrix.json), and [benchmark instructions](../../bench/README.md).
- On this case-insensitive macOS checkout, the repository type check reports existing `Motion`/`motion` filename conflicts in four examples. Consumer type checks in framework and Next.js fixtures are separate checks.
