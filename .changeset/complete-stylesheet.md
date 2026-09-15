---
'zyzz': patch
---

Publish `zyzz.css` from `Host` builds and the `zyzz build`/`zyzz dev` commands: one stylesheet holding shared contributions followed by every module stylesheet with dependencies before their consumers, with a composed source map. Applications load that file instead of linking each module stylesheet by hand.
