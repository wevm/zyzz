# Examples

Small framework playgrounds using the public Zyzz API. Start with [React + Vite](react).

```sh
pnpm install
pnpm examples
```

Run commands from the repository root. `pnpm examples` runs `pnpm dev` to link the local library to source, then starts the Vite dev server. No build is required. Playground changes reload automatically.

## Deployments

The Examples workflow builds and deploys React to Cloudflare Pages on main and same-repository PRs. Main updates production; PRs use preview branches such as `pr-130`. One PR comment updates with an example, URL, and status table. Fork PRs skip deployment and comments.

Create a Direct Upload Pages project with production branch `main`:

```sh
pnpm dlx wrangler pages project create zyzz-examples-react --production-branch main
```

Configure repository secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (Account / Cloudflare Pages / Edit). The optional repository variable `CLOUDFLARE_REACT_PROJECT` overrides the project name. Missing secrets skip deployment and appear in the PR table; build or deployment failures fail the workflow.

The workflow can also run manually. Production deploys require the `main` ref; other refs create previews. Deployment builds are separate from the local `pnpm examples` dev command.

```sh
pnpm dev
pnpm --filter @zyzz/example-react build
```

See [Cloudflare’s Direct Upload setup](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/) for project and token configuration.
