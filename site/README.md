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

## Visualize Variables

Open `/vars` for the default variables. `/vars/default` remains available.

Pass JSON variable data in the `v` query parameter. The page accepts a raw variable record or `{ name, vars, mappings }`. An optional name replaces the Zyzz logo; mappings are optional category-to-CSS-property arrays. Use `lz-string` to shorten the URL:

```ts
import LZString from 'lz-string'

const config = {
  name: 'My design system',
  vars: {
    palette: { brand: '#0072f5' },
    space: { sm: '8px', md: '16px' },
  },
  mappings: { palette: ['color'], space: ['padding', 'gap'] },
}

const url = new URL('/vars', 'https://your-zyzz-site.example')
url.searchParams.set(
  'v',
  `lz:${LZString.compressToEncodedURIComponent(JSON.stringify(config))}`,
)
```

Send resolved JSON values, excluding functions, runtime helpers, and CSS reference objects. The page displays the supplied data without executing a configuration module. Nested paths, light/dark colors, and typography with `default` and media overrides are preserved. Unknown categories use readable names; previews use mappings, property names, and value formats.

The page uses its own theme. Declared font stacks use fonts already available to the browser; the configuration does not load font files. Malformed payloads display an error. Payloads are limited to 32,000 encoded characters, 1,000,000 decoded characters, 20,000 values, and 24 nesting levels.

`test/fixtures/vars/tempo.json` provides a resolved Tempo configuration for regression coverage.
