---
'zyzz': patch
---

Publish `zyzz.css` and `zyzz.js` from `Host` builds and the `zyzz build`/`zyzz dev` commands. The stylesheet holds shared contributions followed by every module stylesheet with dependencies before their consumers, with a composed source map. The script restores the saved theme and scheme of every configuration before paint; `--script` and `Host.create({ script })` move it to a bundler's public directory. `Host.create` defaults `outDir` to `dist`.
