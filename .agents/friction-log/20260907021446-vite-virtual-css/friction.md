---
title: 'Vite virtual CSS request tests need the HTTP middleware'
severity: 'minor'
---

Direct transformRequest calls do not decode Vite browser-facing /@id/**x00** URLs. Adapter integration tests now request the emitted URL through the real HTTP dev server so virtual module resolution follows the browser path.
