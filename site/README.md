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

`/playground` offers Styles and Variants React examples and a Vanilla JS example. A Web Worker compiles source with the Rust compiler for a live preview, generated CSS, and rewritten source. Share links encode source, framework, and tab order in the URL fragment. Existing React links remain supported.

The default Styles example uses light/dark color pairs in its config. The preview inherits the page's Light, Dark, or System scheme through CSS, without recompiling source or resetting application state.

File tabs support dragging and Alt+Left/Right reordering without changing CSS emission order. The plus button adds top-level `.ts`, `.tsx`, `.js`, or `.jsx` files, up to 20 files. React mounts `App.tsx`. Vanilla JS mounts a DOM node returned by `App.js`. `index.*` is reserved for preview bootstrapping.

The page renders its controls and source before loading Monaco, the syntax highlighter, or the preview. Monaco uses the docs' Tempo themes. The isolated preview uses Sandpack and needs network access. It is not an offline or private execution environment.

Site `dev` and `build` generate the playground assets automatically with the pinned Rust toolchain and `wasm32-wasip1` target. `pnpm --dir site build:playground` builds them separately. Browsers fetch the generated manifest, runtime, and full compiler from `public/playground`. Other routes and typechecks do not require these assets. The library's lightweight CSS Wasm is unchanged.

## Search

The docs dialog searches a MiniSearch index of every page and `##` or `###` section, built from the MDX sources and loaded on first use.

## Crawlers & Agents

`/robots.txt` points crawlers to `/sitemap.xml`, which lists the home page, the variables explorer, and every documentation page.

`/llms.txt` links every documentation page's Markdown in sidebar order, and `/llms-full.txt` concatenates the pages. The home page returns `/llms.txt` to agents, terminal clients, and `Accept` headers that prefer Markdown or plain text.
