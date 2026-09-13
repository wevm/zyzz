# Examples

Small framework playgrounds using the public Zyzz API. Start with [React + Vite](react).

```sh
pnpm install
pnpm examples
```

Run commands from the repository root. `pnpm examples` runs `pnpm dev` to link the local library to source, then starts the Vite dev server. No build is required. Playground changes reload automatically.

## Deployments

The Examples workflow builds the library and React playground, then uploads the static output to Cloudflare Pages. Pushes to main deploy production; same-repository pull requests deploy to `pr-<number>` preview branches. Fork pull requests build without deployment credentials.

Create the `zyzz-example-react` Pages project with `main` as its production branch:

```sh
npx wrangler pages project create zyzz-example-react --production-branch main
```

Configure these repository secrets:

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Account containing the Pages project. |
| `CLOUDFLARE_API_TOKEN` | API token with Account / Cloudflare Pages / Edit for that account. |

The workflow updates one PR comment with an Example, URL, and Status table, including build and deploy failures. Successful rows link to the exact deployment. The same table appears in the workflow summary. Manual runs deploy the selected branch.

Local `pnpm examples` continues to start the dev server. Production builds run only in the dedicated Examples workflow.

Deployment uses [Cloudflare's Wrangler action](https://github.com/cloudflare/wrangler-action).
