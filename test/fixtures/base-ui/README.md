# Base UI Integration

`Select.tsx` renders the real Base UI Select with styles from `zyzz/base-ui/react`. `Config.ts` supplies shared tokens and shorthands. The integration suite compiles this graph and exercises it in Chromium with source rewriting enabled and disabled.

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

`test/conformance/base-ui.json` lists supported parts and explicit deferrals. Generic or inherited prop interfaces, unbounded attribute domains, and non-DOM parts remain outside the component-first contract. Ordinary `style({ selectors: … })` remains available for those parts.

## Limits

- **Component references:** The compiler accepts direct imports from the Base UI root or documented component subpaths, including aliases and namespace imports. Local wrappers, dynamic component expressions, and re-exported component aliases are not supported.
- **Authoring:** Component-first calls accept static objects. Dynamic callbacks, composition arrays, and component-first variants are not supported. Ordinary style and variants overloads remain available.
- **Validation:** `states` checks names and finite values. `selectors` supplies whole-key suggestions but accepts arbitrary CSS, including application-owned attributes. It is not a CSS language server for compound selector fragments.
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
