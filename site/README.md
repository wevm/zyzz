# Site

Minimal TanStack Start app for Cloudflare Workers, based on the [official template](https://github.com/TanStack/router/tree/ac223be01377f09fa8fd70ff52c9ba4b5dbcddfc/examples/react/start-basic-cloudflare). Demo routes, assets, Tailwind, and devtools are omitted.

From the repository root:

```sh
pnpm install
pnpm --dir site dev
pnpm --dir site build
pnpm --dir site preview
```

To deploy the `zyzz-site` Worker to your authenticated Cloudflare account:

```sh
pnpm --dir site exec wrangler login
pnpm --dir site deploy
```

Run `pnpm --dir site types` after adding Worker bindings.
