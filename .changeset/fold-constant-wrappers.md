---
'zyzz': patch
---

Production builds fold wrapper components whose element carries a constant `cx` call, a constant imported application, or a constant `className`, and components whose element spreads one dynamic style call filled from their props. A use site of such a component renders the host element with its class list and inline style.
