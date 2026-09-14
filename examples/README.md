# Examples

Small framework playgrounds using the public Zyzz API. Start with [React + Vite](vite-react).

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

Run commands from the repository root. `pnpm examples` builds the library, relinks the `zyzz` binary into each example, then starts every dev server in parallel. Playground changes reload automatically; library changes need another `pnpm build`.

Start one example with `pnpm --dir examples/<name> dev` after `pnpm build`. The Vite examples also run against source-linked output from `pnpm dev`; the CLI and API examples load the compiled `dist` package from Node and require `pnpm build`.

## Deployments

The Examples workflow discovers every `examples/*/package.json` and runs independent build/deploy jobs. Each package owns its `build` script and produces a static site at `dist/index.html`. Folder names use lowercase letters, digits, and hyphens, start with a letter, and contain at most 31 characters.

Adding an example requires no workflow changes:

```json
{
  "scripts": {
    "build": "vite build --configLoader runner"
  }
}
```

Main deploys each example to a Cloudflare Worker named `zyzz-examples-<folder>`. Same-repository PRs deploy isolated `zyzz-examples-<folder>-pr-<number>` Workers, deleted when the PR closes. Fork PRs build only. Manual runs are restricted to main. Workers are created during deployment; no Pages project is needed.

Configure these repository secrets and enable the account's workers.dev subdomain:

| Secret                  | Value                                                             |
| ----------------------- | ----------------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID` | Account containing the Workers.                                   |
| `CLOUDFLARE_API_TOKEN`  | API token with Account / Workers Scripts / Edit for that account. |

One updating PR comment lists every example in an Example, URL, and Status table. Failed examples do not cancel other examples. Missing credentials appear as skipped, and the table also appears in the workflow summary.

Deployments serve static assets using [Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/). Server-rendered examples must provide a static export for this workflow. Local `pnpm examples` continues to start dev servers.
