---
'zyzz': patch
---

Added `colorScheme="system"` to the native Provider, following the device appearance and switching color-only scheme differences on iOS through dynamic colors without updates.

```tsx
<Provider colorScheme="system">{children}</Provider>
```
