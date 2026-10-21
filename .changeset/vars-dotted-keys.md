---
'zyzz': patch
---

Added dotted variable keys below a category, such as `spacing: { 0.5: '2px' }`, in `defineVars`, `extendVars`, and `defineConfig`. A dotted key resolves as a token name (`gap: 0.5`) and as a reference (`vars.spacing[0.5]`), and emits `--z-spacing-0-5`. Category and typography keys still reject dots, and two paths that join to one dotted name, such as `'0.5'` and `0: { 5 }`, throw `Vars.InvalidError`. Keys containing `!` now report `Expected a nonempty variable key without importance or conditions.`
