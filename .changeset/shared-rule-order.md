---
'zyzz': patch
---

Fixed atomic rules that several modules shared under one readable name, such as `z-text-red`, losing the cascade position of the module that defined them. Shared atomic names now include the module qualifier, such as `z-bgXhTU-text-red`, so an override from a consuming module wins over the imported component's declarations.
