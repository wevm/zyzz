# Examples

Framework playgrounds using the public Zyzz API. Start with [React + Vite](vite-react).

| Example                    | Framework | Compilation                                            |
| -------------------------- | --------- | ------------------------------------------------------ |
| [vite-react](vite-react)   | React     | `zyzz()` Vite plugin                                   |
| [vite-solid](vite-solid)   | Solid     | `zyzz()` Vite plugin                                   |
| [vite-svelte](vite-svelte) | Svelte    | `zyzz()` Vite plugin                                   |
| [cli-react](cli-react)     | React     | `zyzz build` / `zyzz dev` CLI; Vite bundles the output |
| [api-react](api-react)     | React     | `Host` from `zyzz/node`; Vite's JavaScript API bundles |

```sh
pnpm install
pnpm examples
```

Run from the repository root. `pnpm examples` builds the library, relinks the `zyzz` binary into each example, then starts each example's dev server. Playground changes reload automatically; library changes need another `pnpm build`.

Start one example with `pnpm --dir examples/<name> dev` after `pnpm build`. The Vite examples also run against source-linked output from `pnpm dev`; the CLI and API examples load the built package from Node and require `pnpm build`.

## Deployments

The Examples workflow discovers every `examples/*/package.json` and builds each one in its own job. An example needs only a `build` script that writes a static site to `dist/index.html`:

```json
{
  "scripts": {
    "build": "vite build --configLoader runner"
  }
}
```

Server-rendered examples must provide a static export. An example whose site builds elsewhere names the directory under `config.site` in its `package.json`; the compiled-tree examples use `build` because `zyzz build` owns `dist`.

| Event              | Deployment                                                         |
| ------------------ | ------------------------------------------------------------------ |
| Push to `main`     | Cloudflare Worker `zyzz-examples-<folder>`                         |
| Same-repository PR | Isolated `zyzz-examples-<folder>-pr-<number>`, deleted on PR close |
| Fork PR            | Build only                                                         |
| Manual run         | Allowed from `main` only                                           |

Workers serve [static assets](https://developers.cloudflare.com/workers/static-assets/) and are created during deployment; no Pages project is needed. Configure these repository secrets and enable the account's workers.dev subdomain:

| Secret                  | Value                                                        |
| ----------------------- | ------------------------------------------------------------ |
| `CLOUDFLARE_ACCOUNT_ID` | Account containing the Workers                               |
| `CLOUDFLARE_API_TOKEN`  | Token with Account / Workers Scripts / Edit for that account |

One updating PR comment and the workflow summary list each example with its URL and status. A failed example does not cancel the others, and missing credentials show as skipped.
