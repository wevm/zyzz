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

The docs dialog searches a MiniSearch index of every page and `##` or `###` section, built from the MDX sources and loaded on first use. `POST /api/search` adds Cloudflare AI Search results from the `zyzz-search` instance bound as `AI_SEARCH` in `wrangler.jsonc`, and the dialog merges them with the keyword results.

Local servers reach the instance only when `CLOUDFLARE_API_TOKEN` is set. Without it, the route answers 503 and the dialog keeps its keyword results.

### AI Search Setup

Cloudflare rejects a deploy whose `AI_SEARCH` binding names a missing instance, so `zyzz-search` must exist before the binding in `wrangler.jsonc` deploys. The site's domain must be on the same Cloudflare account.

```sh
# Crawls the pages that /sitemap.xml lists, keeping only documentation paths
pnpm --dir site exec wrangler ai-search create zyzz-search --type web-crawler --source https://zyzz.sh --parse-type sitemap --include-items '**/docs/**'
```

- **Content selector:** In the instance's website settings, add `[data-docs-content]` for `**/docs/**`, so chunks hold the article without the header and navigation.
- **Discovery:** `/robots.txt` points to `/sitemap.xml`, which lists the home page, the variables explorer, and every documentation page.
- **Sync:** AI Search re-crawls every 6 hours by default. `pnpm --dir site exec wrangler ai-search jobs create zyzz-search` starts a crawl after a deploy.
