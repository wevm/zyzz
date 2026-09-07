# Source and design-token provenance

This is an independent private proof of concept. No affiliation with Vercel, Geist, Tailwind Labs, or StyleX is implied.

## Geist

- Color semantics: https://vercel.com/geist/colors
- Typography: https://vercel.com/geist/typography
- Font family information: https://vercel.com/font
- Snapshot retrieved 2026-09-07 from the stylesheet linked by both official Geist pages:
  https://vercel.com/vc-ap-b3331f/_next/static/immutable/chunks/0ggp-66pwlt2m.css
- SHA-256 of the retrieved stylesheet: `ec205bee3ef6e6f0920703d79055cd9251990ecb23e12515a9ed041068245a28`

`src/internal/Geist.ts` records numerical color/typography design data transcribed from the public stylesheet. It contains all 92 sRGB colors in each scheme, 30 typography presets, and the 15 strong-child overrides present in that snapshot. The source's P3 enhancements are not included in this POC. Surrounding website code, components, and font binaries are not copied into the core package. Before public distribution, review the design-data attribution/permissions and current upstream source terms.

The example uses `@fontsource-variable/geist` and `@fontsource-variable/geist-mono` 5.3.0. Font packages retain their own licenses and notices.

## Tailwind

Spacing, radius, breakpoint, shadow, and easing values are derived from `tailwindcss` 4.3.3, `theme.css`. Tailwind is a development-only reference dependency and is not required to compile or render typestyle styles.

- Theme documentation: https://tailwindcss.com/docs/theme
- Source: https://github.com/tailwindlabs/tailwindcss
- License: MIT, Copyright (c) Tailwind Labs, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Build integration references

- Vite plugin API: https://vite.dev/guide/api-plugin
- Vite HMR hook compatibility: https://vite.dev/changes/hotupdate-hook
- Monoshot agent conventions: https://github.com/wevm/monoshot/blob/main/AGENTS.md

The root `AGENTS.md` records the exact upstream blob and project-specific adaptations.
