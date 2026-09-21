# Site

Minimal TanStack Start app for Cloudflare Workers, generated with the [official TanStack CLI](https://tanstack.com/cli/latest/docs/quick-start) blank Cloudflare template.

Run from the repository root:

```sh
pnpm install
pnpm build
pnpm --dir site dev
```

Zyzz is linked from the workspace. The route modules use `zyzz/default`, and the Vite plugin compiles their styles, with the reset included by `zyzz({ reset: true })`.

The site runs at http://localhost:3000. The home page is `site/src/routes/index.tsx`.

```sh
pnpm --dir site check:types
pnpm --dir site build
pnpm --dir site preview
```

After authenticating with `pnpm --dir site exec wrangler login`, build and deploy with `pnpm --dir site deploy`. The Worker name is `zyzz-site`.
