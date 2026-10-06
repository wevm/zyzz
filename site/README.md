# Site

Minimal TanStack Start app for Cloudflare Workers, generated with the [official TanStack CLI](https://tanstack.com/cli/latest/docs/quick-start) blank Cloudflare template.

Run from the repository root:

```sh
pnpm install
pnpm build
pnpm --dir site dev
```

Zyzz is linked from the workspace. `src/zyzz.config.ts` declares global styles and fonts and re-exports `style` from `zyzz/default`. The Vite plugin compiles the styles, with `zyzz/reset.css` loaded in the document head.

The site runs at http://localhost:3000. The home page is `site/src/routes/index.tsx`.

```sh
pnpm --dir site check:types
pnpm --dir site build
pnpm --dir site preview
```

After authenticating with `pnpm --dir site exec wrangler login`, build and deploy with `pnpm --dir site deploy`. The Worker name is `zyzz-site`.

## Search

The docs dialog searches a MiniSearch index of every page and `##` or `###` section, built from the MDX sources and loaded on first use.

## Crawlers & Agents

`/robots.txt` points crawlers to `/sitemap.xml`, which lists the home page, the variables explorer, and every documentation page.

`/llms.txt` links every documentation page's Markdown in sidebar order, and `/llms-full.txt` concatenates the pages. The home page returns `/llms.txt` to agents, terminal clients, and `Accept` headers that prefer Markdown or plain text.
