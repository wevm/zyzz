---
'zyzz': patch
---

Shipped native compiler addons for macOS (arm64, x64), Windows (arm64, x64), and Linux glibc and musl (arm64, x64). Linux glibc addons now link against glibc 2.17, so they load on Amazon Linux 2023, RHEL 9, Debian 11, and Ubuntu 20.04. Other platforms still load the WebAssembly fallback.
