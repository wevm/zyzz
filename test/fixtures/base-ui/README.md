# Base UI Prototype

> [!NOTE]
> This is a type-only experiment, not a published integration. `Style.ts` declares an API for editor exploration. It has no runtime implementation and must not be executed. No compiler, generated CSS, or existing public API changes are included.

## Authoring

Pass the imported component directly. No component wrapper, registry configuration, or duplicate component namespace is needed at the call site.

```ts
import { Select } from '@base-ui/react/select'
import { style } from './Style.js'

namespace styles {
  // The component supplies selector suggestions, not component props.
  export const item = style(Select.Item, {
    selectors: {
      '&[data-highlighted]': { backgroundColor: 'blue' },
      '&[data-selected]': { fontWeight: 600 },
    },
  })
}
```

The prototype covers `Select.Item`, `Select.Popup`, and `Select.Trigger` against the locked Base UI 1.8.0 types. A Zyzz-owned catalog matches callback-state shapes and supplies explicit DOM attribute names. String-valued attributes derive their values from Base UI state types. Ordinary CSS selectors remain accepted and nested declarations retain Zyzz validation.

## Evidence

```sh
# Exercise the real TypeScript language service against installed Base UI types.
pnpm test run test/fixtures/base-ui/Style.test.ts

# Check the consumer type fixtures with the repository's TypeScript compiler.
pnpm check:types
```

The completion test queries positions inside partially typed selector keys. It checks Item, Popup, Trigger, popup side values, nested selector blocks, an unsupported component, and an intentional structural collision. Consumer fixtures check callable props, ordinary overloads, arbitrary selectors, and rejected declarations. This is language-service evidence, not a VS Code UI recording.

## Limits

- **Structural identity:** A custom component with an identical callback-state shape receives the same hints. Unsupported state shapes receive no Base UI hints. Matching props or import names in conditional types cannot establish nominal identity.
- **DOM mappings:** State keys cannot be mechanically converted to attributes. Popup `open` maps to `data-open` and `data-closed`. Trigger `open` uses `data-popup-open`. Transitions use `data-starting-style` and `data-ending-style`.
- **Completion scope:** The experiment suggests whole selector keys, including enumerated values. It is not a CSS language server for arbitrary selector expressions. Hints do not reject misspelled attribute names or prove attributes reach the DOM through a custom `render` element.
- **Implementation scope:** Configured themes, variants, dynamic styles, component unions, other component libraries, runtime dispatch, and source extraction are not implemented by this prototype. Registration and the eventual public entrypoint remain undecided.

## Upstream Contract

Base UI could attach an optional, type-only attribute schema to each exported component declaration. This describes DOM attributes directly rather than requiring consumers to reconstruct runtime state mappings.

```ts
// Illustrative upstream declaration, not an existing Base UI API.
declare const SelectItem: ExistingSelectItemComponent & {
  readonly __baseUiAttributes?: {
    'data-disabled': true
    'data-highlighted': true
    'data-selected': true
  }
}
```

Here `true` means a presence attribute. A popup schema would give `data-side` its literal value union and list both transition attributes. A shared unique-symbol key could replace the illustrative property name. The schema must remain visible on the final `memo` or `forwardRef` export, but needs no runtime property.

Zyzz could infer that schema from `typeof Select.Item` without a state-shape catalog. Base UI could generate the declarations alongside its documented data attributes and check them against rendered output. The consumer syntax could stay `style(Select.Item, {...})` while the metadata source changes.

## Production Follow-Up

Before publishing this overload, normalize component-first calls consistently in runtime authoring and Rust extraction, retain configured token inference, and verify emitted CSS and interactions with real Base UI components. Define which component references are accepted at compile time, preserve expression side effects, and measure inference cost. The component must not become part of CSS identity or create a runtime React dependency in the core.
