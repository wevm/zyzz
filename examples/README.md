# Examples

Framework playgrounds using the public Zyzz API. Start with [React + Vite](vite-react).

| Example                                | Framework           | Compilation                                            |
| -------------------------------------- | ------------------- | ------------------------------------------------------ |
| [react-native](react-native/README.md) | React Native / Expo | Ahead-of-time native compilation before Metro          |
| [vite-react](vite-react)               | React               | `zyzz()` Vite plugin                                   |
| [vite-solid](vite-solid)               | Solid               | `zyzz()` Vite plugin                                   |
| [vite-svelte](vite-svelte)             | Svelte              | `zyzz()` Vite plugin                                   |
| [cli-react](cli-react)                 | React               | `zyzz build` / `zyzz dev` CLI; Vite bundles the output |
| [api-react](api-react)                 | React               | `Host` from `zyzz/node`; Vite's JavaScript API bundles |
| [next.js](next.js)                     | React               | `zyzz(nextConfig)` from `zyzz/next`; App Router        |
| [tanstack-start](tanstack-start)       | React               | `zyzz()` Vite plugin beside TanStack Start             |

For local development, run `pnpm install` and `pnpm dev` from the repository root, then run `pnpm dev` from an example directory.

After changing library source, rerun `pnpm dev` from the repository root.
