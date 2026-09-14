# zyzz/vite

> [!NOTE]
> Initial Vite 8 integration. Supports physical JavaScript/TypeScript within the Vite root, including lazy modules. Packed theme authoring requires adjacent compiler metadata. Named `Config.create` instances are supported; cyclic static graphs and raw dependency source authoring remain unsupported.

Connect source transformation and CSS delivery to Vite.

| API                   | Description                                                        |
| --------------------- | ------------------------------------------------------------------ |
| [targets](targets.md) | Keep native `light-dark()` in a Vite build of precompiled output.  |
| [zyzz](zyzz.md)       | Create the Vite plugin for source transformation and CSS delivery. |
