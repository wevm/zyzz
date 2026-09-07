# Architecture

## Authoring contract

```ts
import { css } from 'typestyle'

const button = css({
  typography: 'button.14',
  paddingInline: 4,
  paddingBlock: 2,
  color: 'white',
  backgroundColor: 'blue.700',
  borderRadius: 'md',
  ':hover': { backgroundColor: 'blue.800' },
  '@md': { paddingInline: 6 },
})
```

`button` is a string. The same call can appear in a JSX `className` expression. Frameworks are not involved in compilation. Numeric spacing uses 0.25rem; border widths use pixels; transition times use milliseconds. A literal `[CSS value]` is an explicit escape outside token checking. TypeScript cannot prove that all structurally valid values are static; the compiler enforces the static subset.

## Modules

| Module                            | Ownership                                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `Style.ts`                        | Public mapped types; property domains and typed conditions                                                |
| `Tokens.ts` / `internal/Geist.ts` | Design-token authority and source snapshot                                                                |
| `internal/Properties.ts`          | Shared supported-property/domain registry                                                                 |
| `Compiler.ts`                     | Parse, resolve macro bindings, validate literals, resolve tokens, emit classes/CSS and module source maps |
| `Vite.ts`                         | Per-plugin CSS registry, virtual CSS imports, invalidation, and production delegation to Vite             |
| `Build.ts`                        | Directory traversal, TypeScript checks/declarations, ESM output, aggregate CSS, owned-output manifest     |
| `cli.ts`                          | Thin standalone command adapter                                                                           |

## Compilation and ordering

Babel identifies the lexical binding of the named import. Every reference must be a direct call. The compiler reads literal objects, checks property and token domains, and emits rules without evaluating expressions or loading application modules. The macro import is removed. MagicString retains mappings for source locations around the edits.

Classes use a 20-hex-character prefix of SHA-256 over emitted rule content. This identity is independent of filenames, machines, and Vite/CLI mode. Equal styles within one module are deduplicated. Cross-module repeated CSS is not globally optimized in the POC.

Each call produces a scoped rule group. Declaration insertion order is preserved for native CSS shorthand semantics. Typography presets expand before explicit declarations, so explicit properties override the preset. Supported pseudo-classes use a fixed order; breakpoints emit from small to large, independent of object key order. Reduced-motion rules are ordered after responsive rules. Conditions may nest. Classes from separate calls use the ordinary CSS cascade; concatenating strings is not a precedence API.

## Vite

The plugin runs before TypeScript/JSX transforms. It adds an import for one virtual CSS module per source file. Vite owns dev stylesheet delivery and production extraction. The plugin maintains no global mutable state. Hot updates recompile the source, replace the module's CSS, and invalidate the virtual CSS module, including when a file loses its final style. Changing a style also changes its content-derived class name, so normal framework JS refresh boundaries still apply.

The Vite adapter does not run a full TypeScript checker, matching Vite's own model. `tsc --noEmit` remains a required type-safety gate. The compiler independently rejects unknown properties, invalid tokens, dynamic values, and invalid literal forms.

## Standalone library output

The standalone builder checks the original library source using TypeScript, emits declarations, compiles styles through the same core, and transpiles modules to ESM. It is a compiler, not a dependency bundler. Source-relative `.js` imports remain relative. A library consumes its own dependencies normally. Consumers import the generated `styles.css` once and do not need the typestyle Vite plugin.

All compilation finishes before writing. `.typestyle-manifest.json` tracks generated files so repeat builds replace only owned output and remove stale generated modules. Unrelated files are preserved. Source and output directories must not overlap. This protects previous good builds from compilation errors; filesystem failures during writing are not transactional.

## Theme and browser assumptions

Geist sRGB colors are inlined as `light-dark(light, dark)` values. The inherited CSS `color-scheme` selects the scheme; there is no JS theme provider. Font presets emit stacks, while the application supplies Geist font assets. Modern browsers with `light-dark()` support are the POC target. P3 enhancement, configurable token variables, and older-browser transforms are follow-up work.
