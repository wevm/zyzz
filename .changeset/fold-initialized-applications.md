---
'zyzz': patch
---

Dropped initialization guards from applications inside function expressions when no earlier module statement can call them, and folded recipe and dynamic applications spread alone onto elements so their definitions, unread namespace members, and known `cx` argument reads no longer ship.
