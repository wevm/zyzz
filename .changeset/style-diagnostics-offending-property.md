---
'zyzz': patch
---

Fixed invalid `typography` sets reducing the whole `style` or `variants` object type to `never`. The error now stays on the offending property and lists the accepted set names. Invalid shorthand alias tokens also list their accepted tokens.
