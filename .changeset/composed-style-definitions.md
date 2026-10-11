---
'zyzz': patch
---

Allowed `style` to compose earlier static definitions and literal objects from an array, such as `style([button, focusRing, { color: 'white' }])`. Entries compile in order into one definition with its own rules on web and native targets.
