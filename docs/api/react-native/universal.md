# Universal Styling

> [!NOTE]
> This contract specifies the universal API work. Static native tables, target branches, variants, and local callable source compilation are implemented. Imported native graphs, packed callable contracts, host updates, and renderer acceptance remain pending.

The universal API retains `style`, `variants`, themes, tokens, and `cx` across web and native. Shared modules keep the same declarations and callable inputs. Application returns platform styling props for spreading onto ordinary components: web receives class/style bindings, native receives a style binding.

## Target Resolution

The compiler selects the output target explicitly. It must not inspect the device during shared authoring or make import order determine the target. Package metadata preserves target-neutral definitions so separate web and native builds can consume the same library.

Target selection belongs to compiler configuration. A native host supplies scheme, platform, density, accessibility, and interaction inputs explicitly. Root imports remain independent of React Native and its renderer.

## Value Semantics

Shared declarations retain the documented CSS value meanings. For example, a shared numeric line height is a multiplier. Native numeric line height is an absolute logical-unit value. Native-only values must have an explicit authoring boundary so the same literal never changes meaning silently.

Lengths, flex defaults, inherited text, transforms, colors, and fonts require documented conversion rules. Conversion cannot remove a legal native value from the target-specific capability set. Native opaque colors and animated values stay in host adapters without serialization, coercion, or freezing.

## Target Branches

The `targets` field contains `web`, `native`, `ios`, and `android` declaration branches. Shared declarations apply first, followed by the matching broad target and then the platform branch. The compiler rejects unknown targets and nonportable unqualified declarations.

Branches preserve authoring order internally. They use the destination's value semantics and native property domains. Immutable literal source imports, re-exports, and version-20 packed style contracts retain these branches. Static native variant application uses bounded selection tables. Unresolved external constants require source or an already compiled style contract.

## Composition

Native composition must accept existing native style objects, nested style arrays, and falsy entries. Later styles override earlier ones without deep-merging structured property values. Empty/falsy composition preserves references where React Native does. Host-owned objects remain caller-owned.

The universal `cx` contract must preserve platform styling props, static variants, and active dynamic bindings. Native helper interoperability is a prerequisite, not proof that universal source compilation is complete.

## Acceptance

The pinned React Native 0.87.0 declarations in `test/conformance/native` define the initial audit denominator. `pnpm check:native` verifies hashes, inherited property coverage, API signatures, and generated inventory drift. It does not certify value-domain or renderer parity.

`pnpm check:native:full` deliberately fails while full acceptance is unimplemented. Replace this pending guard with executed evidence checks as the conformance runner lands. Do not turn it green by filtering the inventory or treating unsupported entries as not applicable.

The inventory retains legacy and published declarations, actual runtime exports, and referenced type names. Static image and value domains are audited. Animated/opaque domains, OS requirements, renderer architecture, and rendered behavior remain host and device acceptance work. iOS and Android must each match independent React Native controls before full parity can pass.
