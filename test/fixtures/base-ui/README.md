# Base UI Integration

`Select.tsx` renders the real Base UI Select with styles from `zyzz/base-ui/react`. `Config.ts` supplies shared tokens and shorthands. `Coverage.tsx` exercises numeric indices, arbitrary toast types, supplemental fieldset state, and viewport child selectors. Both fixtures run in Chromium with source rewriting enabled and disabled.

```tsx
import { Select } from '@base-ui/react/select'
import { style } from 'zyzz/base-ui/react'

// Spread ordinary styling props onto the original component.
function Fruit() {
  return (
    <Select.Root defaultValue="apple">
      <Select.Trigger>
        <Select.Value />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner>
          <Select.Popup>
            <Select.Item value="apple" {...styles.item()}>
              Apple
            </Select.Item>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}

namespace styles {
  export const item = style(Select.Item, {
    states: {
      // Suggested and checked against Select.Item's documented data attributes.
      highlighted: { backgroundColor: 'lightblue' },
      selected: { fontWeight: 700 },
    },
    // Attribute completions are also available here, alongside arbitrary CSS.
    selectors: { '&[data-app-state="busy"]': { opacity: 0.5 } },
  })
}
```

## Configuration

Import `defineConfig` from `zyzz/base-ui/react` to bind the same component-first overload to configured variables, layers, and shorthands. Other helpers retain their existing contracts. The entrypoint produces React props and does not load Base UI components at runtime.

```ts
import { defineConfig } from 'zyzz/base-ui/react'

// The existing variable configuration also applies inside states.
export const { style, vars } = defineConfig({
  vars: { color: { accent: 'blue' } },
})
```

## Synchronization

The pinned Base UI 1.8.0 declarations are the input for `scripts/base-ui.ts`. It follows public component and DataAttributes aliases, reads documented attribute values, and generates component hints, TSDoc links, runtime spellings, and the Rust catalog. CI checks deterministic output and declaration fingerprints without fetching upstream data.

```sh
# Review upstream changes and coverage before committing regenerated files.
pnpm update:base-ui
pnpm check:base-ui

# Check language-service hints and real rendered state transitions.
pnpm test run src/base-ui/react/Style.test.ts scripts/base-ui.test.ts
```

`test/conformance/base-ui.json` lists all 246 supported DOM parts, 24 non-DOM parts, and reviewed metadata supplements. Generic and inherited component contracts are supported. Generation fails on unhandled DOM parts or attribute modules. Tests independently enumerate the package's component exports and type-check every supported part with `skipLibCheck: false`.

Supplements cover missing domains and emitted hooks omitted from upstream declarations, including disabled fieldsets, empty lists, and field-state labels. Their TSDoc links to pinned implementations. They require review on upstream upgrades, without assuming semver stability. Providers, collections, render-only values, imperative handles, and internal ownership markers have no DOM styling contract.

Base UI 1.8.0 has declaration/runtime discrepancies. Combobox and Autocomplete Input/Trigger declare `required` without emitting `data-required`. Select.Arrow declares `side: 'none'` but does not render in that mode. These declared keys remain available, with TSDoc caveats, but cannot match absent attributes.

## Limits

- **Component references:** The compiler accepts direct imports from the Base UI root or documented component subpaths, including aliases and namespace imports. Local wrappers, dynamic component expressions, and re-exported component aliases are not supported.
- **Authoring:** Component-first calls accept static objects. Dynamic callbacks, composition arrays, and component-first variants are not supported. Ordinary style and variants overloads remain available.
- **Validation:** `states` checks names and finite values. Numeric domains accept finite canonical numeric keys, including zero and negative indices. Toast types accept arbitrary strings with CSS escaping, except NUL. `selectors` supplies whole-key suggestions but accepts arbitrary CSS, including application-owned attributes.
- **Child hooks:** Menu, Popover, PreviewCard, and Tooltip Viewport `current` and `previous` states target direct-child containers. Their transition attributes can be combined with `selectors`, such as `& > [data-current][data-starting-style]`. They do not describe the viewport element itself.
- **Type identity:** Optional, type-only props augmentation distinguishes documented parts and compatible aliases. Props-preserving wrappers retain hints structurally, but compiler import validation still rejects those wrappers. Custom `render` elements must forward Base UI attributes.
- **CSS-only mode:** The runtime expands attribute spellings without a component registry. Types and source extraction validate component-specific domains. No CSS rules are inserted at runtime.

## Upstream Contract

Base UI could publish an optional type-only attribute schema on each final component export. Zyzz could then infer the documented DOM contract directly, without augmenting props or maintaining component identities. The consumer call would remain `style(Select.Item, declarations)`.

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

Here `true` denotes presence. A popup schema would give `data-side` its literal value union. A shared unique-symbol key could replace the illustrative property name. Metadata must remain visible on the final `memo` or `forwardRef` export, but requires no runtime property.
