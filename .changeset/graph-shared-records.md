---
'zyzz': patch
---

Fixed `zyzz build --css-only` and other shared-stylesheet hosts failing on large graphs with `Failed to convert rust String into napi string`. Graph results no longer repeat the graph's token resources and scope rules in every module, so their size stays proportional to the source instead of the module count times the theme size.
