# Examples

Framework playgrounds using the public Zyzz API. Start with [React + Vite](react).

```sh
pnpm install
pnpm examples
```

Run from the repository root. `pnpm examples` links the local library to source with `pnpm dev`, then starts each example's Vite dev server. No build is required; changes reload automatically.

## Deployments

The Examples workflow discovers every `examples/*/package.json` and builds each one in its own job. An example needs only a `build` script that writes a static site to `dist/index.html`:

```json
{
  "scripts": {
    "build": "vite build --configLoader runner"
  }
}
```

Server-rendered examples must provide a static export.

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
