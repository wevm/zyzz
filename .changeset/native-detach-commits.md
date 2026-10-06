---
'zyzz': patch
---

Fixed React Native views committing the shadow tree once per styled view when unmounting or re-rendering after a theme change, which took seconds for 1,000 views.
