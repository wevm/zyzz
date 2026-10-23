---
'zyzz': patch
---

Folded wrapper components whose element carries a constant `cx` call, a constant imported application, or a constant `className`, and components whose element spreads one dynamic style call filled from their props, in production builds. A use site of such a component renders the host element directly with its class list and inline style, and a folded field that is never empty dropped its `unset` fallback.
