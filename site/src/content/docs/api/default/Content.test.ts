/** Builds and type-checks the default config reference examples through the packed compiler contract. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Module from 'node:module'
import * as Path from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test'
import { appearance, script, tokens, vars } from 'zyzz/default'
import { Host } from 'zyzz/node'

const project = Path.resolve(import.meta.dirname, '../../../../../..')
const require = Module.createRequire(import.meta.url)
let root = ''

beforeAll(async () => {
  root = await Fs.mkdtemp(Path.join(project, '.fixture-default-api-'))
  await Fs.mkdir(Path.join(root, 'node_modules'))
  await Fs.symlink(project, Path.join(root, 'node_modules/zyzz'), 'dir')
  for (const name of ['@types', 'react-native'])
    await Fs.symlink(
      Path.join(project, 'node_modules', name),
      Path.join(root, 'node_modules', name),
      'dir',
    )
})

afterAll(async () => {
  if (root) await Fs.rm(root, { force: true, recursive: true })
})

/** Reads a page's importing examples in order, optionally from one section. */
async function examples(page: string, heading?: string | undefined) {
  const document = await Fs.readFile(
    new URL(`../${page}.mdx`, import.meta.url),
    'utf8',
  )
  const section =
    heading === undefined
      ? document
      : document
          .split(/^#{2,3} /m)
          .find((entry) => entry.startsWith(`${heading}\n`))
  if (section === undefined)
    throw new Error(`${page} has no ${heading} section.`)

  return Array.from(
    section.matchAll(/```tsx?([^\n]*)\n([\s\S]*?)```/g),
    (match) => ({
      name: match[1]!.match(/title="([^"]+)"/)?.[1],
      source: match[2]!,
    }),
  ).filter((example) => example.source.includes('import '))
}

/** Builds one example through the filesystem compiler and returns its rules, without the bundled variable and scheme blocks. */
async function build(
  name: string,
  example: { name?: string | undefined; source: string },
  assets: readonly string[] = [],
) {
  const directory = Path.join(root, name)
  const file = Path.basename(example.name ?? 'Example.tsx')
  await Fs.mkdir(directory)
  // Module-level definitions emit only when exported or applied.
  await Fs.writeFile(
    Path.join(directory, file),
    example.source.replace(/^(const|namespace) /gm, 'export $1 '),
  )
  for (const asset of assets)
    await Fs.writeFile(Path.join(directory, asset), '')

  await using host = await Host.create({
    outDir: Path.join(directory, 'dist'),
    packageId: 'default-api',
    root: directory,
  })
  await host.build()

  const css = await Fs.readFile(
    Path.join(directory, 'dist', `${file}.css`),
    'utf8',
  )
  return css
    .split('\n\n')
    .filter((block) => !/^\.(z-theme-|z_scheme-)/.test(block))
    .join('\n\n')
}

describe('default API page', () => {
  test('exports runtime helpers and leaves authoring to the compiler', () => {
    // The published module, not the source alias this suite resolves.
    const published = ChildProcess.spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        "const entry = await import('zyzz/default'); console.log(typeof entry.style, typeof entry.variants)",
      ],
      { cwd: root, encoding: 'utf8', timeout: 30000 },
    )

    expect(published.stdout).toMatchInlineSnapshot(`
      "undefined undefined
      "
    `)
    expect(Object.keys(appearance)).toMatchInlineSnapshot(`
      [
        "get",
        "set",
      ]
    `)
    expect(
      script().includes('localStorage.getItem("zyzz")'),
    ).toMatchInlineSnapshot(`true`)
    expect(vars({ colorScheme: 'dark' })).toMatchInlineSnapshot(`
      {
        "className": "z-theme-default-theme z_scheme-dark",
        "style": {
          "colorScheme": "dark",
        },
      }
    `)
  })
})

describe('Tokens API page', () => {
  test('builds the overview example', async () => {
    const [card] = await examples('default/tokens')

    expect(await build('tokens-overview', card!)).toMatchInlineSnapshot(`
      ".z-default-border-radius-\\[var\\(--z-default-radius-lg\\,0\\.5rem\\)\\] {
        border-radius: var(--z-default-radius-lg, .5rem);
      }

      .z-default-text-\\[var\\(--z-default-color-blue-700\\,\\#0072f5\\)\\] {
        color: var(--z-default-color-blue-700, #0072f5);
      }

      .z-default-p-\\[var\\(--z-default-spacing-4\\,1rem\\)\\] {
        padding: var(--z-default-spacing-4, 1rem);
      }
      "
    `)
  })

  test('builds color, spacing, and font tokens', async () => {
    const [colors] = await examples('default/tokens', 'Colors')
    const [spacing] = await examples('default/tokens', 'Spacing')
    const [fonts] = await examples('default/tokens', 'Fonts')

    expect(await build('tokens-colors', colors!)).toMatchInlineSnapshot(`
      ".z-default-bg-\\[var\\(--z-default-color-background-surface\\,light-dark\\(\\#fff\\,\\#0a0a0a\\)\\)\\] {
        background-color: var(--z-default-color-background-surface, light-dark(#fff, #0a0a0a));
      }

      .z-default-text-\\[var\\(--z-default-color-foreground\\,light-dark\\(\\#171717\\,\\#ededed\\)\\)\\] {
        color: var(--z-default-color-foreground, light-dark(#171717, #ededed));
      }
      "
    `)
    expect(await build('tokens-spacing', spacing!)).toMatchInlineSnapshot(`
      ".z-default-gap-\\[var\\(--z-default-spacing-px\\,1px\\)\\] {
        gap: var(--z-default-spacing-px, 1px);
      }

      .z-default-p-\\[var\\(--z-default-spacing-4\\,1rem\\)\\] {
        padding: var(--z-default-spacing-4, 1rem);
      }

      .z-default-mt-13px {
        margin-top: 13px;
      }
      "
    `)
    expect(await build('tokens-fonts', fonts!)).toMatchInlineSnapshot(`
      ".z-default-font-family-\\[var\\(--z-default-fontFamily-mono\\,_22_Geist_20_Mono_22_\\,_20_ui-monospace\\,_20_SFMono-Regular\\,_20_Menlo\\,_20_Monaco\\,_20_Consolas\\,_20__22_Liberation_20_Mono_22_\\,_20__22_Courier_20_New_22_\\,_20_monospace\\)\\] {
        font-family: var(--z-default-fontFamily-mono, "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace);
      }

      .z-default-font-size-\\[var\\(--z-default-fontSize-sm\\,0\\.875rem\\)\\] {
        font-size: var(--z-default-fontSize-sm, .875rem);
      }

      .z-default-font-weight-\\[var\\(--z-default-fontWeight-medium\\,500\\)\\] {
        font-weight: var(--z-default-fontWeight-medium, 500);
      }

      .z-default-line-height-\\[var\\(--z-default-lineHeight-relaxed\\,1\\.625\\)\\] {
        line-height: var(--z-default-lineHeight-relaxed, 1.625);
      }
      "
    `)
  })

  test('builds size, effect, and query tokens', async () => {
    const [sizes] = await examples('default/tokens', 'Sizes')
    const [mapped, referenced] = await examples('default/tokens', 'Effects')
    const [queries] = await examples('default/tokens', 'Queries')

    expect(await build('tokens-sizes', sizes!)).toMatchInlineSnapshot(`
      ".z-default-aspect-ratio-\\[var\\(--z-default-aspect-video\\,16_20_\\/_20_9\\)\\] {
        aspect-ratio: var(--z-default-aspect-video, 16 / 9);
      }

      .z-default-border-radius-\\[var\\(--z-default-radius-xl\\,0\\.75rem\\)\\] {
        border-radius: var(--z-default-radius-xl, .75rem);
      }

      .z-default-max-width-\\[var\\(--z-default-container-2xl\\,42rem\\)\\] {
        max-width: var(--z-default-container-2xl, 42rem);
      }
      "
    `)
    expect(await build('tokens-effects', mapped!)).toMatchInlineSnapshot(`
      ".z-default-animation-\\[var\\(--z-default-animate-spin\\,z-kid-zyzz_5f_2d_5f_spin_20_1s_20_linear_20_infinite\\)\\] {
        animation: var(--z-default-animate-spin, z-kid-zyzz_2d_spin 1s linear infinite);
      }

      .z-default-box-shadow-\\[var\\(--z-default-shadow-md\\,0_20_4px_20_6px_20_-1px_20_rgb\\(0_20_0_20_0_20_\\/_20_0\\.1\\)\\,_20_0_20_2px_20_4px_20_-2px_20_rgb\\(0_20_0_20_0_20_\\/_20_0\\.1\\)\\)\\] {
        box-shadow: var(--z-default-shadow-md, 0 4px 6px -1px #0000001a, 0 2px 4px -2px #0000001a);
      }
      "
    `)
    expect(await build('tokens-references', referenced!))
      .toMatchInlineSnapshot(`
      ".z-default-backdrop-filter-\\[blur\\(var\\(--z-default-blur-md\\,12px\\)\\)\\] {
        backdrop-filter: blur(var(--z-default-blur-md, 12px));
      }

      .z-default-box-shadow-\\[var\\(--z-default-insetShadow-sm\\,inset_20_0_20_2px_20_4px_20_rgb\\(0_20_0_20_0_20_\\/_20_0\\.05\\)\\)\\] {
        box-shadow: var(--z-default-insetShadow-sm, inset 0 2px 4px #0000000d);
      }
      "
    `)
    expect(await build('tokens-queries', queries!)).toMatchInlineSnapshot(`
      ".z-default-KS_EuJ-grid-display-0 {
        display: grid;
      }

      @media (width >= 48rem) {
        .z-default-KS_EuJ-grid-grid-template-columns-1 {
          grid-template-columns: 1fr 1fr;
        }
      }

      .z-default-KS_EuJ-grid-gap-2 {
        @container (width >= 24rem) {
          gap: var(--z-default-spacing-4, 1rem);
        }
      }
      "
    `)
  })

  test('lists the documented raw values', () => {
    expect(tokens.color.blue[700]).toMatchInlineSnapshot(`"#0072f5"`)
    expect(tokens.color.foreground).toMatchInlineSnapshot(`
      {
        "dark": "#ededed",
        "light": "#171717",
      }
    `)
    expect(tokens.color.gray[1000]).toMatchInlineSnapshot(`
      {
        "dark": "#ededed",
        "light": "#171717",
      }
    `)
    expect(tokens.color.black).toMatchInlineSnapshot(`"#000"`)
    expect(tokens.color.white).toMatchInlineSnapshot(`"#fff"`)
    expect(Object.keys(tokens.color)).toMatchInlineSnapshot(`
      [
        "amber",
        "background",
        "black",
        "blue",
        "foreground",
        "gray",
        "grayAlpha",
        "green",
        "pink",
        "purple",
        "red",
        "teal",
        "white",
      ]
    `)
    expect(Object.keys(tokens.color.blue)).toMatchInlineSnapshot(`
      [
        "100",
        "200",
        "300",
        "400",
        "500",
        "600",
        "700",
        "800",
        "900",
        "1000",
      ]
    `)
    expect(tokens.color.background).toMatchInlineSnapshot(`
      {
        "primary": {
          "dark": "#000",
          "light": "#fafafa",
        },
        "surface": {
          "dark": "#0a0a0a",
          "light": "#fff",
        },
      }
    `)
    expect(tokens.spacing).toMatchInlineSnapshot(`
      {
        "0": "0rem",
        "1": "0.25rem",
        "10": "2.5rem",
        "11": "2.75rem",
        "12": "3rem",
        "14": "3.5rem",
        "16": "4rem",
        "2": "0.5rem",
        "20": "5rem",
        "24": "6rem",
        "28": "7rem",
        "3": "0.75rem",
        "32": "8rem",
        "36": "9rem",
        "4": "1rem",
        "40": "10rem",
        "44": "11rem",
        "48": "12rem",
        "5": "1.25rem",
        "52": "13rem",
        "56": "14rem",
        "6": "1.5rem",
        "60": "15rem",
        "64": "16rem",
        "7": "1.75rem",
        "72": "18rem",
        "8": "2rem",
        "80": "20rem",
        "9": "2.25rem",
        "96": "24rem",
        "px": "1px",
      }
    `)
    expect(tokens.fontFamily).toMatchInlineSnapshot(`
      {
        "mono": ""Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace",
        "sans": "Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"",
        "serif": "ui-serif, Georgia, Cambria, "Times New Roman", Times, serif",
      }
    `)
    expect(tokens.fontSize).toMatchInlineSnapshot(`
      {
        "2xl": "1.5rem",
        "3xl": "1.875rem",
        "4xl": "2.25rem",
        "5xl": "3rem",
        "6xl": "3.75rem",
        "7xl": "4.5rem",
        "8xl": "6rem",
        "9xl": "8rem",
        "base": "1rem",
        "lg": "1.125rem",
        "sm": "0.875rem",
        "xl": "1.25rem",
        "xs": "0.75rem",
      }
    `)
    expect(tokens.fontWeight).toMatchInlineSnapshot(`
      {
        "black": 900,
        "bold": 700,
        "extrabold": 800,
        "extralight": 200,
        "light": 300,
        "medium": 500,
        "normal": 400,
        "semibold": 600,
        "thin": 100,
      }
    `)
    expect(Object.keys(tokens.letterSpacing)).toMatchInlineSnapshot(`
      [
        "tighter",
        "tight",
        "normal",
        "wide",
        "wider",
        "widest",
      ]
    `)
    expect(tokens.lineHeight).toMatchInlineSnapshot(`
      {
        "loose": 2,
        "normal": 1.5,
        "relaxed": 1.625,
        "snug": 1.375,
        "tight": 1.25,
      }
    `)
    expect(tokens.radius).toMatchInlineSnapshot(`
      {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
        "lg": "0.5rem",
        "md": "0.375rem",
        "sm": "0.25rem",
        "xl": "0.75rem",
        "xs": "0.125rem",
      }
    `)
    expect(tokens.container).toMatchInlineSnapshot(`
      {
        "2xl": "42rem",
        "2xs": "18rem",
        "3xl": "48rem",
        "3xs": "16rem",
        "4xl": "56rem",
        "5xl": "64rem",
        "6xl": "72rem",
        "7xl": "80rem",
        "lg": "32rem",
        "md": "28rem",
        "sm": "24rem",
        "xl": "36rem",
        "xs": "20rem",
      }
    `)
    expect(tokens.aspect).toMatchInlineSnapshot(`
      {
        "video": "16 / 9",
      }
    `)
    expect(Object.keys(tokens.shadow)).toMatchInlineSnapshot(`
      [
        "2xs",
        "xs",
        "sm",
        "md",
        "lg",
        "xl",
        "2xl",
        "inner",
      ]
    `)
    expect(Object.keys(tokens.textShadow)).toMatchInlineSnapshot(`
      [
        "2xs",
        "xs",
        "sm",
        "md",
        "lg",
      ]
    `)
    expect(Object.keys(tokens.perspective)).toMatchInlineSnapshot(`
      [
        "dramatic",
        "near",
        "normal",
        "midrange",
        "distant",
      ]
    `)
    expect(Object.keys(tokens.ease)).toMatchInlineSnapshot(`
      [
        "in",
        "out",
        "in-out",
      ]
    `)
    expect(Object.keys(tokens.animate)).toMatchInlineSnapshot(`
      [
        "spin",
        "ping",
        "pulse",
        "bounce",
      ]
    `)
    expect(tokens.blur).toMatchInlineSnapshot(`
      {
        "2xl": "40px",
        "3xl": "64px",
        "lg": "16px",
        "md": "12px",
        "sm": "8px",
        "xl": "24px",
        "xs": "4px",
      }
    `)
    expect(Object.keys(tokens.dropShadow)).toMatchInlineSnapshot(`
      [
        "xs",
        "sm",
        "md",
        "lg",
        "xl",
        "2xl",
      ]
    `)
    expect(Object.keys(tokens.insetShadow)).toMatchInlineSnapshot(`
      [
        "2xs",
        "xs",
        "sm",
      ]
    `)
    expect(tokens.breakpoint).toMatchInlineSnapshot(`
      {
        "2xl": "96rem",
        "lg": "64rem",
        "md": "48rem",
        "sm": "40rem",
        "xl": "80rem",
      }
    `)
  })
})

describe('Typography API page', () => {
  test('builds the overview, set, and variant examples', async () => {
    const [article] = await examples('default/typography')
    const [sets] = await examples('default/typography', 'Sets')
    const [variants] = await examples('default/typography', 'Variants')

    expect(await build('typography-overview', article!)).toMatchInlineSnapshot(`
      ".z-default--n2A4x-styles-title-font-family-0 {
        font-family: var(--z-default-typography-heading-32-fontFamily, Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji");
      }

      .z-default--n2A4x-styles-title-font-size-1 {
        font-size: var(--z-default-typography-heading-32-fontSize, 32px);
      }

      .z-default--n2A4x-styles-title-font-weight-2 {
        font-weight: var(--z-default-typography-heading-32-fontWeight, 600);
      }

      .z-default--n2A4x-styles-title-letter-spacing-3 {
        letter-spacing: var(--z-default-typography-heading-32-letterSpacing, -1.28px);
      }

      .z-default--n2A4x-styles-title-line-height-4 {
        line-height: var(--z-default-typography-heading-32-lineHeight, 40px);
      }

      .z-default--n2A4x-styles-body-font-family-0 {
        font-family: var(--z-default-typography-copy-16-fontFamily, Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji");
      }

      .z-default--n2A4x-styles-body-font-size-1 {
        font-size: var(--z-default-typography-copy-16-fontSize, 16px);
      }

      .z-default--n2A4x-styles-body-font-weight-2 {
        font-weight: var(--z-default-typography-copy-16-fontWeight, 400);
      }

      .z-default--n2A4x-styles-body-letter-spacing-3 {
        letter-spacing: var(--z-default-typography-copy-16-letterSpacing, 0px);
      }

      .z-default--n2A4x-styles-body-line-height-4 {
        line-height: var(--z-default-typography-copy-16-lineHeight, 24px);
      }
      "
    `)
    expect(await build('typography-sets', sets!)).toMatchInlineSnapshot(`
      ".z-default-font-family-\\[var\\(--z-default-typography-button-14-fontFamily\\,Geist\\,_20_-apple-system\\,_20_BlinkMacSystemFont\\,_20__22_Segoe_20_UI_22_\\,_20_Roboto\\,_20__22_Helvetica_20_Neue_22_\\,_20__22_Noto_20_Sans_22_\\,_20_Arial\\,_20_sans-serif\\,_20__22_Apple_20_Color_20_Emoji_22_\\,_20__22_Segoe_20_UI_20_Emoji_22_\\,_20__22_Segoe_20_UI_20_Symbol_22_\\,_20__22_Noto_20_Color_20_Emoji_22_\\)\\] {
        font-family: var(--z-default-typography-button-14-fontFamily, Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji");
      }

      .z-default-font-size-\\[var\\(--z-default-typography-button-14-fontSize\\,14px\\)\\] {
        font-size: var(--z-default-typography-button-14-fontSize, 14px);
      }

      .z-default-font-weight-\\[var\\(--z-default-typography-button-14-fontWeight\\,500\\)\\] {
        font-weight: var(--z-default-typography-button-14-fontWeight, 500);
      }

      .z-default-letter-spacing-\\[var\\(--z-default-typography-button-14-letterSpacing\\,0px\\)\\] {
        letter-spacing: var(--z-default-typography-button-14-letterSpacing, 0px);
      }

      .z-default-line-height-\\[var\\(--z-default-typography-button-14-lineHeight\\,20px\\)\\] {
        line-height: var(--z-default-typography-button-14-lineHeight, 20px);
      }
      "
    `)
    expect(await build('typography-variants', variants!))
      .toMatchInlineSnapshot(`
      ".z-default-KS_EuJ-styles-code-font-family-0 {
        font-family: var(--z-default-typography-label-14-mono-fontFamily, "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace);
      }

      .z-default-KS_EuJ-styles-code-font-size-1 {
        font-size: var(--z-default-typography-label-14-mono-fontSize, 14px);
      }

      .z-default-KS_EuJ-styles-code-font-weight-2 {
        font-weight: var(--z-default-typography-label-14-mono-fontWeight, 400);
      }

      .z-default-KS_EuJ-styles-code-letter-spacing-3 {
        letter-spacing: var(--z-default-typography-label-14-mono-letterSpacing, 0px);
      }

      .z-default-KS_EuJ-styles-code-line-height-4 {
        line-height: var(--z-default-typography-label-14-mono-lineHeight, 20px);
      }

      .z-default-KS_EuJ-styles-emphasis-font-family-0 {
        font-family: var(--z-default-typography-copy-16-strong-fontFamily, Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji");
      }

      .z-default-KS_EuJ-styles-emphasis-font-size-1 {
        font-size: var(--z-default-typography-copy-16-strong-fontSize, 16px);
      }

      .z-default-KS_EuJ-styles-emphasis-font-weight-2 {
        font-weight: var(--z-default-typography-copy-16-strong-fontWeight, 550);
      }

      .z-default-KS_EuJ-styles-emphasis-letter-spacing-3 {
        letter-spacing: var(--z-default-typography-copy-16-strong-letterSpacing, 0px);
      }

      .z-default-KS_EuJ-styles-emphasis-line-height-4 {
        line-height: var(--z-default-typography-copy-16-strong-lineHeight, 24px);
      }
      "
    `)
  })

  test('builds overrides, conditions, and field references', async () => {
    const [overrides] = await examples('default/typography', 'Overrides')
    const [conditions] = await examples('default/typography', 'Conditions')
    const [field] = await examples('default/typography', 'Field References')

    expect(await build('typography-overrides', overrides!))
      .toMatchInlineSnapshot(`
      ".z-default-KS_EuJ-styles-body-font-weight-0 {
        font-weight: var(--z-default-fontWeight-medium, 500);
      }

      .z-default-KS_EuJ-styles-body-font-family-1 {
        font-family: var(--z-default-typography-copy-14-fontFamily, Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji");
      }

      .z-default-KS_EuJ-styles-body-font-size-2 {
        font-size: var(--z-default-typography-copy-14-fontSize, 14px);
      }

      .z-default-KS_EuJ-styles-body-letter-spacing-3 {
        letter-spacing: var(--z-default-typography-copy-14-letterSpacing, 0px);
      }

      .z-default-KS_EuJ-styles-body-line-height-4 {
        line-height: var(--z-default-typography-copy-14-lineHeight, 20px);
      }

      .z-default-KS_EuJ-styles-pinned-font-family-0 {
        font-family: var(--z-default-typography-label-13-fontFamily, Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji") !important;
      }

      .z-default-KS_EuJ-styles-pinned-font-size-1 {
        font-size: var(--z-default-typography-label-13-fontSize, 13px) !important;
      }

      .z-default-KS_EuJ-styles-pinned-font-weight-2 {
        font-weight: var(--z-default-typography-label-13-fontWeight, 400) !important;
      }

      .z-default-KS_EuJ-styles-pinned-letter-spacing-3 {
        letter-spacing: var(--z-default-typography-label-13-letterSpacing, 0px) !important;
      }

      .z-default-KS_EuJ-styles-pinned-line-height-4 {
        line-height: var(--z-default-typography-label-13-lineHeight, 16px) !important;
      }
      "
    `)
    expect(await build('typography-conditions', conditions!))
      .toMatchInlineSnapshot(`
      ".z-default-KS_EuJ-styles-link-font-family-0 {
        font-family: var(--z-default-typography-label-14-fontFamily, Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji");
      }

      .z-default-KS_EuJ-styles-link-font-size-1 {
        font-size: var(--z-default-typography-label-14-fontSize, 14px);
      }

      .z-default-KS_EuJ-styles-link-font-weight-2 {
        font-weight: var(--z-default-typography-label-14-fontWeight, 400);
      }

      .z-default-KS_EuJ-styles-link-letter-spacing-3 {
        letter-spacing: var(--z-default-typography-label-14-letterSpacing, 0px);
      }

      .z-default-KS_EuJ-styles-link-line-height-4 {
        line-height: var(--z-default-typography-label-14-lineHeight, 20px);
      }

      .z-default-KS_EuJ-styles-link-font-family-5 {
        &:hover {
          font-family: var(--z-default-typography-label-14-strong-fontFamily, Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji");
        }
      }

      .z-default-KS_EuJ-styles-link-font-size-6 {
        &:hover {
          font-size: var(--z-default-typography-label-14-strong-fontSize, 14px);
        }
      }

      .z-default-KS_EuJ-styles-link-font-weight-7 {
        &:hover {
          font-weight: var(--z-default-typography-label-14-strong-fontWeight, 500);
        }
      }

      .z-default-KS_EuJ-styles-link-letter-spacing-8 {
        &:hover {
          letter-spacing: var(--z-default-typography-label-14-strong-letterSpacing, 0px);
        }
      }

      .z-default-KS_EuJ-styles-link-line-height-9 {
        &:hover {
          line-height: var(--z-default-typography-label-14-strong-lineHeight, 20px);
        }
      }

      .z-default-KS_EuJ-styles-text-font-family-0 {
        &:where([data-size="lg"]) {
          font-family: var(--z-default-typography-copy-16-fontFamily, Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji");
        }
      }

      .z-default-KS_EuJ-styles-text-font-size-1 {
        &:where([data-size="lg"]) {
          font-size: var(--z-default-typography-copy-16-fontSize, 16px);
        }
      }

      .z-default-KS_EuJ-styles-text-font-weight-2 {
        &:where([data-size="lg"]) {
          font-weight: var(--z-default-typography-copy-16-fontWeight, 400);
        }
      }

      .z-default-KS_EuJ-styles-text-letter-spacing-3 {
        &:where([data-size="lg"]) {
          letter-spacing: var(--z-default-typography-copy-16-letterSpacing, 0px);
        }
      }

      .z-default-KS_EuJ-styles-text-line-height-4 {
        &:where([data-size="lg"]) {
          line-height: var(--z-default-typography-copy-16-lineHeight, 24px);
        }
      }

      .z-default-KS_EuJ-styles-text-font-family-5 {
        &:where([data-size="sm"]) {
          font-family: var(--z-default-typography-copy-13-fontFamily, Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji");
        }
      }

      .z-default-KS_EuJ-styles-text-font-size-6 {
        &:where([data-size="sm"]) {
          font-size: var(--z-default-typography-copy-13-fontSize, 13px);
        }
      }

      .z-default-KS_EuJ-styles-text-font-weight-7 {
        &:where([data-size="sm"]) {
          font-weight: var(--z-default-typography-copy-13-fontWeight, 400);
        }
      }

      .z-default-KS_EuJ-styles-text-letter-spacing-8 {
        &:where([data-size="sm"]) {
          letter-spacing: var(--z-default-typography-copy-13-letterSpacing, 0px);
        }
      }

      .z-default-KS_EuJ-styles-text-line-height-9 {
        &:where([data-size="sm"]) {
          line-height: var(--z-default-typography-copy-13-lineHeight, 18px);
        }
      }
      "
    `)
    expect(await build('typography-field', field!)).toMatchInlineSnapshot(`
      ".z-default-font-size-\\[var\\(--z-default-typography-heading-32-fontSize\\,32px\\)\\] {
        font-size: var(--z-default-typography-heading-32-fontSize, 32px);
      }
      "
    `)
  })

  test('lists the documented set sizes and variants', () => {
    const sets = Object.fromEntries(
      Object.entries(tokens.typography).map((entry) => [
        entry[0],
        Object.entries(entry[1]).map((size) =>
          [
            size[0],
            size[1].fontWeight,
            ...['mono', 'strong', 'subtle'].flatMap((variant) =>
              variant in size[1]
                ? [
                    `${variant} ${(size[1] as Record<string, { fontWeight: number }>)[variant]!.fontWeight}`,
                  ]
                : [],
            ),
          ].join(' '),
        ),
      ]),
    )

    expect(sets.button).toMatchInlineSnapshot(`
      [
        "12 500",
        "14 500",
        "16 500",
      ]
    `)
    expect(sets.copy).toMatchInlineSnapshot(`
      [
        "13 400 mono 400",
        "14 400 strong 550",
        "16 400 strong 550",
        "18 400 strong 550",
        "20 400 strong 550",
        "24 400 strong 550",
      ]
    `)
    expect(sets.heading).toMatchInlineSnapshot(`
      [
        "14 600",
        "16 600 subtle 500",
        "20 600 subtle 500",
        "24 600 subtle 500",
        "32 600 subtle 500",
        "40 600",
        "48 600",
        "56 600",
        "64 600",
        "72 600",
      ]
    `)
    expect(sets.label).toMatchInlineSnapshot(`
      [
        "12 400 mono 400 strong 500",
        "13 400 mono 400 strong 500",
        "14 400 mono 400 strong 500",
        "16 400 strong 500",
        "18 400",
        "20 400",
      ]
    `)
    expect(tokens.typography.heading[32]).toMatchInlineSnapshot(`
      {
        "fontFamily": "Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"",
        "fontSize": "32px",
        "fontWeight": 600,
        "letterSpacing": "-1.28px",
        "lineHeight": "40px",
        "subtle": {
          "fontFamily": "Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"",
          "fontSize": "32px",
          "fontWeight": 500,
          "letterSpacing": "-1.28px",
          "lineHeight": "40px",
        },
      }
    `)
    expect(tokens.typography.label[14].mono.fontFamily).toMatchInlineSnapshot(
      `""Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace"`,
    )
  })

  test('builds the font face example', async () => {
    const [font] = await examples('default/typography', 'Font Loading')
    const directory = Path.join(root, 'typography-font')
    await Fs.mkdir(directory)
    await Fs.writeFile(Path.join(directory, 'fonts.ts'), font!.source)
    await Fs.writeFile(Path.join(directory, 'Geist.woff2'), '')

    await using host = await Host.create({
      outDir: Path.join(directory, 'dist'),
      packageId: 'default-api',
      root: directory,
    })
    await host.build()

    expect(await Fs.readFile(Path.join(directory, 'dist/zyzz.css'), 'utf8'))
      .toMatchInlineSnapshot(`
      "@font-face {
        font-display: swap;
        font-family: Geist;
        src: url("Geist.woff2") format("woff2");
      }
      "
    `)
  })
})

describe('default API examples', () => {
  test('type-check against the published declarations', async () => {
    const pages = await Promise.all(
      ['default/tokens', 'default/typography'].map((page) => examples(page)),
    )
    const files = await Promise.all(
      pages
        .flat()
        // Twoslash blocks that declare expected errors are checked by the site build.
        .filter((example) => !example.source.includes('// @errors'))
        .map(async (example, index) => {
          const directory = Path.join(root, 'types', String(index))
          const file = Path.join(
            directory,
            Path.basename(example.name ?? 'Example.tsx'),
          )
          await Fs.mkdir(directory, { recursive: true })
          await Fs.writeFile(file, example.source)
          return file
        }),
    )

    const checked = ChildProcess.spawnSync(
      process.execPath,
      [
        Path.join(
          Path.dirname(require.resolve('typescript/package.json')),
          'bin/tsc',
        ),
        '--ignoreConfig',
        '--noEmit',
        '--strict',
        '--exactOptionalPropertyTypes',
        '--noUncheckedIndexedAccess',
        '--skipLibCheck',
        '--jsx',
        'react-jsx',
        '--module',
        'preserve',
        '--moduleResolution',
        'bundler',
        '--customConditions',
        'react-native',
        '--target',
        'ESNext',
        ...files,
      ],
      { cwd: root, encoding: 'utf8', timeout: 30000 },
    )

    expect(files).toHaveLength(16)
    expect(checked.status, checked.stdout + checked.stderr).toBe(0)
  }, 60_000)
})
