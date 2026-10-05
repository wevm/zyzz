---
'zyzz': patch
---

Fixed style callbacks rejecting `aspectRatio` bindings from positive numeric literal unions, such as `values: { ratio: 1 | 1.5 }`, during compilation.
