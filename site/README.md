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

## Playground

`/playground` edits a two-file React project, compiles it with the Rust compiler in a Web Worker, and displays a live preview, generated CSS, and rewritten TypeScript/JSX. Share links encode the source in the URL fragment. There is no persistence service.

The page renders its controls and source before loading Monaco, the syntax highlighter, or the preview. Monaco uses the docs' Tempo themes. The isolated React preview uses Sandpack and needs network access. It is not an offline or private execution environment.

Site `dev`, `build`, and `check:types` generate the playground assets automatically. This requires the repository's pinned Rust toolchain and `wasm32-wasip1` target. `pnpm --dir site build:playground` builds them separately. Generated runtime files and the full compiler Wasm are ignored. The library's lightweight CSS Wasm keeps its default feature set.

## Search

The docs dialog searches a MiniSearch index of every page and `##` or `###` section, built from the MDX sources and loaded on first use.

## Crawlers & Agents

`/robots.txt` points crawlers to `/sitemap.xml`, which lists the home page, the variables explorer, and every documentation page.

`/llms.txt` links every documentation page's Markdown in sidebar order, and `/llms-full.txt` concatenates the pages. The home page returns `/llms.txt` to agents, terminal clients, and `Accept` headers that prefer Markdown or plain text.
