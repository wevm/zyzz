# Architecture

## Direction

Typestyle is a small, typed, standards-oriented styling system. Its core owns ordered declarations, token resolution, validation, diagnostics, and deterministic identity. It is independent of execution environment, source parser, rendering target, framework, and build tool.

The architecture below is the target of the implementation plan. The existing POC remains a web compiler with Vite and filesystem adapters; this document does not claim native support is implemented.

## Boundaries

| Part               | Responsibility                                                                         | Excluded dependencies                                                          |
| ------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Core               | Pure operations on typed, ordered style data                                           | Node built-ins, filesystem, DOM, device globals, parsers, frameworks, bundlers |
| Presets            | Geist/Tailwind defaults, typed custom tokens, optional aliases                         | Global registration or environment detection                                   |
| Source adapters    | Static TS/TSX or framework-source extraction, bindings, source locations and rewriting | Target semantics and application-code execution                                |
| Web target         | Standard CSS, class references, CSS-specific capability checks                         | Framework components and bundler lifecycle                                     |
| Native target      | Static native style data, documented conversions, native capability checks             | CSS-engine emulation and runtime style generation                              |
| Host adapters      | Vite, Metro, CLI, file resolution, watching, output delivery and lifecycle             | A second implementation of style semantics                                     |
| Framework examples | Consume target output through normal class/style APIs                                  | Mandatory wrappers, providers or custom JSX runtimes                           |

Use modules and subpath exports first. Extensions are explicit data or functions passed through narrow boundaries. Separate packages and more general interfaces require a demonstrated need.

## Data flow

Source extraction produces ordered style data with source locations. The core validates declarations and resolves an explicitly supplied preset. A selected target emits artifacts and target-specific diagnostics. The host decides how to read source and deliver those artifacts.

The core also accepts in-memory style data directly. There is no requirement to install Vite, use a filesystem, parse TypeScript, or run a CLI to access its operations. Extraction, emission, and file delivery are separate contracts.

## Shared authoring and target differences

Portable declarations and token names are shared; output types are target-specific. Web consumers receive class references and CSS. Native consumers receive static data compatible with their style APIs. Target-only declarations are explicitly typed, and unsupported semantics are compilation errors.

React Native accepts objects and arrays through its `style` prop and has differences from browser CSS; sharing an authoring model cannot mean treating a CSS class string as a native style. The native target must document unit conversion, precedence, supported properties, and theme/state selection. See the [React Native style contract](https://reactnative.dev/docs/style).

Geist colors and typography and Tailwind spacing/radius values form a preset rather than a core dependency. Store semantic values independently of web strings such as `light-dark()` and `rem`; target emitters own serialization and conversion. Fonts are supplied by applications through their platform's normal loading mechanism.

## Standards and precedence

Use CSS properties and standard object spelling, CSS values/functions, selectors, at-rules, custom properties, inheritance, and cascade semantics wherever the target supports them. Preserve authored declaration order. Breakpoint conveniences are optional preset aliases with documented expansion; avoid hidden sorting that changes authored precedence.

Web output follows the [CSS cascade and inheritance model](https://www.w3.org/TR/css-cascade-5/). Concatenating classes does not create a new override order. Native composition follows its documented target contract rather than pretending to implement the browser cascade.

The POC's `[value]` escapes, limited condition keys, and fixed pseudo/breakpoint ordering are provisional. Phase 2 revisits them against the standards-first authoring contract without silently changing existing examples during this planning revision.

## Compilation and runtime

All style definitions compile ahead of time. Extraction never evaluates application code. Web emits CSS and removes the authoring macro. Native emits static objects or equivalent data; a small target adapter may select precompiled alternatives for interaction, viewport, scheme, or accessibility inputs.

Runtime state is passed explicitly to the adapter that needs it. No core code reads `window`, `document`, `process`, or device APIs. Native adapters must not become a runtime CSS parser, arbitrary expression evaluator, or style compiler.

## Current implementation and migration

| Current module                        | Next change                                                                                   |
| ------------------------------------- | --------------------------------------------------------------------------------------------- |
| `Style.ts` / `internal/Properties.ts` | Separate portable declarations from target capability types                                   |
| `Tokens.ts` / `internal/Geist.ts`     | Extract configurable preset data and separate target serialization                            |
| `Compiler.ts`                         | Split Babel extraction, semantic processing, and CSS emission; remove `node:crypto` from core |
| `Vite.ts`                             | Keep as an optional thin host adapter                                                         |
| `Build.ts` / `cli.ts`                 | Separate in-memory artifact compilation from filesystem and declaration-emission concerns     |
| `examples/`                           | Retain web baseline; add focused React, Vue, and native fixtures as the relevant phases land  |

The existing standalone builder's ownership manifest, preservation of previous output on compile errors, and ESM/declaration output remain useful host-adapter contracts. The existing 29 tests establish the web baseline only. New core isolation, native behavior, and interoperability gates are specified in `plan.md`.
