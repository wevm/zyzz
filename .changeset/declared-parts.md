---
'zyzz': patch
---

Added `part` and the `Part` type to `zyzz/base-ui/react`. `part(Component, { open: 'boolean', status: ['running', 'done', 'failed'] })` declares a component's `data-*` states, so component-first `style(Component, { states })` checks state names and values and emits `[data-open]` and `[data-status="failed"]` selectors ahead of time, as it does for Base UI parts. The compiler reads the literal descriptor from the declaring module, its re-exports, or a version 37 package contract, and the uncompiled runtime reads it from the component. `Factory` is now exported and names the configured `style` helper, so `export const { style } = defineConfig(...)` emits declarations without TS2883.
