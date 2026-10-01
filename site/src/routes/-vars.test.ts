/** Exercises site routes through HTTP and server-rendered output. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs'
import LZString from 'lz-string'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test'

const origin = 'http://localhost:3136'
let server: ChildProcess.ChildProcess

beforeAll(async () => {
  server = ChildProcess.spawn(
    'node',
    ['node_modules/vite/bin/vite.js', 'dev', '--port', '3136', '--strictPort'],
    {
      cwd: new URL('../..', import.meta.url),
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  let output = ''
  server.stdout?.on('data', (data) => {
    output += data
  })
  server.stderr?.on('data', (data) => {
    output += data
  })
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw new Error(output)
    try {
      if ((await fetch(`${origin}/vars`)).ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Variables site did not start. ${output}`)
}, 60000)

afterAll(() => {
  if (server?.pid && server.exitCode === null)
    process.kill(-server.pid, 'SIGTERM')
})

async function page(config?: unknown, compressed = false) {
  const url = new URL('/vars', origin)
  if (config !== undefined) {
    const json = JSON.stringify(config)
    url.searchParams.set(
      'v',
      compressed ? `lz:${LZString.compressToEncodedURIComponent(json)}` : json,
    )
  }
  const response = await fetch(url)
  expect(response.status).toMatchInlineSnapshot('200')
  return response.text()
}

describe('/vars', () => {
  test('renders defaults and the named compressed Tempo config', async () => {
    const defaults = await page()
    expect(defaults.includes('vars.fontSize.xs')).toMatchInlineSnapshot('true')

    const tempo = JSON.parse(
      Fs.readFileSync(
        new URL('../../../test/fixtures/vars/tempo.json', import.meta.url),
        'utf8',
      ),
    )
    const html = await page({ ...tempo, name: 'Tempo.xyz' }, true)
    expect(html.includes('Tempo.xyz')).toMatchInlineSnapshot('true')
    expect(html.includes('font-size:56px')).toMatchInlineSnapshot('true')
    expect(html.includes('repeat(12, 1fr)')).toMatchInlineSnapshot('true')
    expect(html.includes('Zyzz home')).toMatchInlineSnapshot('false')
    const unicode = await page(
      { name: 'Témṕo 🌍', vars: { color: { ink: '#000' } } },
      true,
    )
    expect(unicode.includes('Témṕo 🌍')).toMatchInlineSnapshot('true')
  })

  test('merges sibling media and container typography blocks', async () => {
    const html = await page({
      typography: {
        heading: {
          fontSize: '24px',
          fontFamily: 'sans-serif',
          lineHeight: '28px',
          '@media >=tablet': { fontSize: '40px' },
          '@container sidebar (min-width: 20rem)': { lineHeight: '48px' },
        },
      },
    })
    expect(
      html.includes('font-size:40px;font-family:sans-serif;line-height:28px'),
    ).toMatchInlineSnapshot('true')
    expect(
      html.includes('font-size:24px;font-family:sans-serif;line-height:48px'),
    ).toMatchInlineSnapshot('true')
    expect(
      html.includes('vars.typography.heading[&quot;@media'),
    ).toMatchInlineSnapshot('false')
  })

  test('retains scalar siblings and authored responsive token references', async () => {
    const html = await page({
      components: { button: { fontSize: '14px', padding: '8px' } },
      spacing: { sm: { default: '8px', '@media (min-width: 48rem)': '16px' } },
    })
    expect(
      html.includes('vars.components.button.padding'),
    ).toMatchInlineSnapshot('true')
    expect(html.includes('vars.spacing.sm.default')).toMatchInlineSnapshot(
      'false',
    )
    expect(html.includes('vars.spacing.sm[&quot;@media')).toMatchInlineSnapshot(
      'false',
    )
    expect(html.includes('vars.spacing.sm')).toMatchInlineSnapshot('true')
    expect(html.includes('16px')).toMatchInlineSnapshot('true')
  })

  test('accepts container metadata and raw vars categories without discarding siblings', async () => {
    const html = await page({
      containerNames: ['sidebar'],
      vars: { brand: 'red' },
      color: { ink: '#123456' },
    })
    expect(html.includes('Could not read variables')).toMatchInlineSnapshot(
      'false',
    )
    expect(html.includes('vars.vars.brand')).toMatchInlineSnapshot('true')
    expect(html.includes('#123456')).toMatchInlineSnapshot('true')
    expect(html.includes('vars.containerNames')).toMatchInlineSnapshot('false')
  })

  test('renders swatches in mixed groups and avoids comparing different units', async () => {
    const html = await page({
      semantic: { brand: '#0072f5', gap: '8px' },
      breakpoint: { sm: '768px', lg: '64rem' },
    })
    expect(html.includes('background-color:#0072f5')).toMatchInlineSnapshot(
      'true',
    )
    expect(html.includes('width:8.333')).toMatchInlineSnapshot('false')
    expect(html.includes('64rem')).toMatchInlineSnapshot('true')
  })

  test('uses mappings and preserves light/dark previews', async () => {
    const html = await page({
      vars: {
        paint: { brand: { light: '#fff', dark: '#000' } },
        corners: { sm: '6px' },
      },
      mappings: { paint: ['color'], corners: ['borderRadius'] },
    })
    expect(html.includes('light-dark(#fff, #000)')).toMatchInlineSnapshot(
      'true',
    )
    expect(html.includes('border-radius:6px')).toMatchInlineSnapshot('true')
  })

  test('rejects non-finite JSON numbers and renders finite numeric typography', async () => {
    const url = new URL('/vars', origin)
    url.searchParams.set(
      'v',
      `lz:${LZString.compressToEncodedURIComponent('{"weight":{"bad":1e309}}')}`,
    )
    const html = await (await fetch(url)).text()
    expect(
      html.includes('Variable numbers must be finite.'),
    ).toMatchInlineSnapshot('true')

    const valid = await page({
      typography: {
        body: {
          fontSize: 16,
          fontWeight: 'bold',
          lineHeight: 1.5,
          letterSpacing: 0,
        },
      },
    })
    expect(
      valid.includes(
        'font-size:16px;font-weight:bold;letter-spacing:0;line-height:1.5',
      ),
    ).toMatchInlineSnapshot('true')
    expect(
      valid.includes('vars.typography.body.fontWeight'),
    ).toMatchInlineSnapshot('true')
  })

  test('renders inherited category names and uses unique accessible IDs', async () => {
    const html = await page({
      toString: { small: '8px' },
      valueOf: { big: '16px' },
      'brand colors': { ink: '#123456' },
      'brand-colors': { ink: '#654321' },
      'brand colors-heading': { ink: '#abcdef' },
    })
    expect(html.includes('vars.toString.small')).toMatchInlineSnapshot('true')
    expect(html.includes('vars.valueOf.big')).toMatchInlineSnapshot('true')
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1])
    expect(ids.some((id) => /\s/.test(id!))).toMatchInlineSnapshot('false')
    expect(new Set(ids).size === ids.length).toMatchInlineSnapshot('true')
    const labels = [...html.matchAll(/ aria-labelledby="([^"]+)"/g)].map(
      (match) => match[1],
    )
    expect(labels.length).toMatchInlineSnapshot('5')
    expect(labels.every((label) => ids.includes(label))).toMatchInlineSnapshot(
      'true',
    )
  })

  test('bounds mappings and renders large mapped and conditional groups', async () => {
    const invalid = await page(
      {
        vars: { space: { sm: '8px' } },
        mappings: { space: Array(257).fill('padding') },
      },
      true,
    )
    expect(
      invalid.includes('at most 256 properties each'),
    ).toMatchInlineSnapshot('true')

    const html = await page(
      {
        vars: {
          space: Object.fromEntries(
            Array.from({ length: 1000 }, (_, index) => [`s${index}`, '8px']),
          ),
          typography: {
            heading: {
              fontSize: '24px',
              ...Object.fromEntries(
                Array.from({ length: 1000 }, (_, index) => [
                  `@media (min-width: ${index}px)`,
                  { lineHeight: 1.5 },
                ]),
              ),
            },
          },
        },
        mappings: { space: ['padding', ...Array(255).fill('unknown')] },
      },
      true,
    )
    expect(html.includes('vars.space.s999')).toMatchInlineSnapshot('true')
    expect(html.includes('@media (min-width: 999px)')).toMatchInlineSnapshot(
      'true',
    )
    expect(
      (html.match(/title="vars.typography.heading"/g) ?? []).length,
    ).toMatchInlineSnapshot('1001')
  })

  test('rejects invalid and oversized compressed configurations at the route', async () => {
    for (const config of [
      null,
      { vars: [] },
      { vars: {}, name: 42 },
      { spacing: ['8px'] },
    ]) {
      const html = await page(config)
      expect(html.includes('Could not read variables')).toMatchInlineSnapshot(
        'true',
      )
    }
    const html = await page({ text: 'x'.repeat(2000000) }, true)
    expect(
      html.includes('The decompressed configuration is too large.'),
    ).toMatchInlineSnapshot('true')
  })
})

describe('/docs', () => {
  test('loads the browser module graph and MDX component', async () => {
    const pending = [
      '/@id/virtual:tanstack-start-dev-client-entry',
      '/src/router.tsx',
    ]
    const visited = new Set<string>()
    for (const path of pending) {
      if (visited.has(path)) continue
      visited.add(path)
      const response = await fetch(`${origin}${path}`)
      expect(response.status, path).toMatchInlineSnapshot('200')
      const code = await response.text()
      expect(
        code.includes('@tanstack/react-start/server'),
        path,
      ).toMatchInlineSnapshot('false')
      for (const match of code.matchAll(
        /(?:from\s*|import\s*\(?\s*)["']([^"']+)["']/g,
      )) {
        const dependency = match[1]!
        if (dependency.startsWith('/src/') || dependency.startsWith('/@id/'))
          pending.push(dependency)
      }
    }
    expect(
      [...visited].some(
        (path) =>
          new URL(path, origin).pathname ===
          '/src/content/docs/introduction/getting-started.mdx',
      ),
    ).toMatchInlineSnapshot('true')
  })

  test('renders the MDX page and shared documentation navigation', async () => {
    const response = await fetch(`${origin}/docs/introduction/getting-started`)
    const html = await response.text()

    expect(response.status).toMatchInlineSnapshot('200')
    expect(
      response.headers.get('content-type')?.includes('text/html'),
    ).toMatchInlineSnapshot('true')
    expect(html.includes('Getting Started · Zyzz')).toMatchInlineSnapshot(
      'true',
    )
    expect(html.includes('Introduction')).toMatchInlineSnapshot('true')
    expect(html.includes('>Guide</h2>')).toMatchInlineSnapshot('false')
    expect(html.includes('>API</h2>')).toMatchInlineSnapshot('false')
    const navbar = html.match(/<header\b[^>]*>([\s\S]*?)<\/header>/)?.[1] ?? ''
    expect(navbar.includes('href="/vars"')).toMatchInlineSnapshot('true')
    const article =
      html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/)?.[1] ?? ''
    const heading =
      article.match(/<header\b[^>]*>([\s\S]*?)<\/header>/)?.[1] ?? ''
    expect(heading.includes('<h1>Getting Started</h1>')).toMatchInlineSnapshot(
      'true',
    )
    expect(
      heading.includes(
        '<p>Get up and running with Zyzz, from config to compiled styles.</p>',
      ),
    ).toMatchInlineSnapshot('true')
    expect(
      article.split(
        'Get up and running with Zyzz, from config to compiled styles.',
      ).length - 1,
    ).toMatchInlineSnapshot('1')
    expect(html.includes('aria-current="page"')).toMatchInlineSnapshot('true')
    expect(html.includes('viewBox="12 24 233 64"')).toMatchInlineSnapshot(
      'true',
    )
    expect(
      html.includes('<span style="color:light-dark('),
    ).toMatchInlineSnapshot('true')
    expect(html.includes('Default Variables (Quick)')).toMatchInlineSnapshot(
      'true',
    )
    expect(html.includes('pnpm')).toMatchInlineSnapshot('true')
    expect(html.includes('Choose Framework')).toMatchInlineSnapshot('true')
    expect(html.includes('>Other Bundlers</span>')).toMatchInlineSnapshot(
      'true',
    )
    expect(html.includes('>Compiler API</span>')).toMatchInlineSnapshot('true')
    expect(html.includes('Add the Vite Plugin')).toMatchInlineSnapshot('true')
    expect(html.includes('Style a Component')).toMatchInlineSnapshot('true')
    expect((article.match(/data-step=""/g) ?? []).length).toMatchInlineSnapshot(
      '5',
    )
    expect((article.match(/data-card=""/g) ?? []).length).toMatchInlineSnapshot(
      '12',
    )
    expect(
      article.includes('Copy instructions for agent'),
    ).toMatchInlineSnapshot('true')
    expect(
      [...article.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((match) => match[1]),
    ).toMatchInlineSnapshot(`
      [
        "Overview",
        "Agent Prompt",
        "Setup",
        "Next Steps",
      ]
    `)
    expect(
      response.headers.get('vary')?.includes('User-Agent'),
    ).toMatchInlineSnapshot('true')
  })

  test('copies the agent prompt and adapts the cards to narrow screens', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const context = await browser.newContext({
        permissions: ['clipboard-read', 'clipboard-write'],
        viewport: { width: 1400, height: 1000 },
      })
      const page = await context.newPage()
      await page.goto(`${origin}/docs/introduction/getting-started`)
      await page.waitForLoadState('networkidle')
      await page
        .getByRole('group', { name: 'Package manager' })
        .getByRole('button', { name: 'pnpm', exact: true })
        .click()
      await page
        .getByRole('button', { name: 'Copy install command', exact: true })
        .click()
      await page
        .getByRole('button', { name: 'Copied install command', exact: true })
        .waitFor()

      expect(
        await page.evaluate(() => navigator.clipboard.readText()),
      ).toMatchInlineSnapshot('"pnpm add zyzz"')

      expect(
        await page
          .locator('pre')
          .filter({ hasText: "from 'vite'" })
          .evaluate((pre) => {
            const header = pre.previousElementSibling
            return {
              filename: header?.textContent,
              icon: Boolean(header?.querySelector('svg')),
            }
          }),
      ).toMatchInlineSnapshot(`
        {
          "filename": "vite.config.ts",
          "icon": true,
        }
      `)
      await page
        .getByRole('button', { name: 'Copy vite.config.ts', exact: true })
        .click()
      await page
        .getByRole('button', { name: 'Copied vite.config.ts', exact: true })
        .waitFor()

      expect(await page.evaluate(() => navigator.clipboard.readText()))
        .toMatchInlineSnapshot(`
        "import { defineConfig } from 'vite'
        import { zyzz } from 'zyzz/vite'

        export default defineConfig({
          plugins: [zyzz()],
        })"
      `)

      expect(
        await page
          .getByRole('link', { name: 'Variables', exact: true })
          .evaluate((link) => {
            const style = getComputedStyle(link)
            return { fontSize: style.fontSize, fontWeight: style.fontWeight }
          }),
      ).toMatchInlineSnapshot(`
        {
          "fontSize": "14px",
          "fontWeight": "500",
        }
      `)

      await page
        .getByRole('button', {
          name: 'Copy instructions for agent',
          exact: true,
        })
        .click()

      await page
        .getByRole('button', { name: 'Copied instructions', exact: true })
        .waitFor()

      expect(
        await page.evaluate(() => navigator.clipboard.readText()),
      ).toMatchInlineSnapshot(
        '"Read zyzz.sh and help me build my project with Zyzz."',
      )
      expect(
        await page
          .getByRole('button', { name: 'Copied instructions', exact: true })
          .count(),
      ).toMatchInlineSnapshot('1')
      const cards = page.locator('[data-card]')
      const first = await cards.nth(0).boundingBox()
      const second = await cards.nth(1).boundingBox()
      expect(first?.y === second?.y).toMatchInlineSnapshot('true')

      for (const [title, integration] of [
        ['Next.js', 'Configure Next.js'],
        ['React Native', 'Configure Metro'],
        ['Other Bundlers', 'Add a Bundler Adapter'],
        ['CLI', 'Compile with the CLI'],
        ['Compiler API', 'Compile Programmatically'],
        ['Vite', 'Add the Vite Plugin'],
      ]) {
        await page.getByRole('button', { name: title!, exact: false }).click()
        const panel = page.locator('#framework-setup')
        expect(
          await panel
            .getByRole('heading', { name: integration!, exact: true })
            .count(),
        ).toMatchInlineSnapshot('1')
        expect(
          await panel
            .getByRole('heading', { name: 'Install Zyzz', exact: true })
            .count(),
        ).toMatchInlineSnapshot('1')
        expect((await panel.locator('h3').allTextContents()).slice(0, 3))
          .toMatchInlineSnapshot(`
          [
            "Install Zyzz",
            "Choose Framework",
            "Choose Mode",
          ]
        `)
        expect(
          (await panel.locator('h3').nth(3).textContent()) === integration,
        ).toMatchInlineSnapshot('true')
        expect(
          await page.locator('[data-card][aria-pressed="true"]').count(),
        ).toMatchInlineSnapshot('2')
      }

      await page
        .getByRole('button', {
          name: 'Custom Variables (Advanced)',
          exact: false,
        })
        .click()
      expect(
        await page
          .getByRole('heading', { name: 'Define Config', exact: true })
          .count(),
      ).toMatchInlineSnapshot('1')
      expect(
        await page
          .getByRole('heading', { name: 'Use Default Variables', exact: true })
          .count(),
      ).toMatchInlineSnapshot('0')

      await page
        .getByRole('button', {
          name: 'Default Variables (Quick)',
          exact: false,
        })
        .click()
      expect(
        await page
          .getByRole('heading', { name: 'Use Default Variables', exact: true })
          .count(),
      ).toMatchInlineSnapshot('0')
      expect(
        await page
          .getByRole('heading', { name: 'Define Config', exact: true })
          .count(),
      ).toMatchInlineSnapshot('0')

      await page.setViewportSize({ width: 600, height: 1000 })
      const mobileFirst = await cards.nth(0).boundingBox()
      const mobileSecond = await cards.nth(1).boundingBox()
      expect(mobileFirst?.x === mobileSecond?.x).toMatchInlineSnapshot('true')
      expect(mobileSecond!.y > mobileFirst!.y).toMatchInlineSnapshot('true')
    } finally {
      await browser.close()
    }
  }, 15000)

  test('collapses docs navigation into a full-screen menu below 1024px', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.goto(`${origin}/docs/introduction/getting-started`)
      await page.waitForLoadState('networkidle')

      for (const width of [1023, 768, 390]) {
        await page.setViewportSize({ width, height: 900 })
        expect(
          await page.getByRole('button', { name: 'Open menu' }).isVisible(),
        ).toMatchInlineSnapshot('true')
        expect(
          await page
            .getByRole('searchbox', { name: 'Search docs' })
            .isVisible(),
        ).toMatchInlineSnapshot('false')
        expect(
          await page
            .getByRole('link', { name: 'Variables', exact: true })
            .isVisible(),
        ).toMatchInlineSnapshot('false')
        expect(
          await page
            .locator('article')
            .evaluate((node) => node.getBoundingClientRect().x),
        ).toMatchInlineSnapshot('0')

        await page.getByRole('button', { name: 'Open menu' }).click()
        const menu = page.getByRole('dialog', { name: 'Documentation menu' })
        expect(await menu.isVisible()).toMatchInlineSnapshot('true')
        expect(
          (await menu.evaluate(
            (node) => node.getBoundingClientRect().width,
          )) === width,
        ).toMatchInlineSnapshot('true')
        expect(
          await menu.evaluate((node) => node.getBoundingClientRect().height),
        ).toMatchInlineSnapshot('900')
        expect(
          await menu
            .getByRole('searchbox', { name: 'Search docs' })
            .isVisible(),
        ).toMatchInlineSnapshot('true')
        expect(
          await menu.getByRole('link', { name: 'Getting Started' }).isVisible(),
        ).toMatchInlineSnapshot('true')
        expect(
          await page.evaluate(() => document.body.style.overflow),
        ).toMatchInlineSnapshot('"hidden"')
        await menu.getByRole('button', { name: 'Close menu' }).click()
        await menu.waitFor({ state: 'hidden' })
        expect(await menu.isVisible()).toMatchInlineSnapshot('false')
        await page.waitForFunction(
          () =>
            document
              .querySelector('[aria-controls="docs-menu"]')
              ?.getAttribute('aria-expanded') === 'false',
        )
        expect(
          await page
            .getByRole('button', { name: 'Open menu' })
            .getAttribute('aria-expanded'),
        ).toMatchInlineSnapshot('"false"')
      }

      await page.getByRole('button', { name: 'Open menu' }).click()
      await page.keyboard.press('Escape')
      expect(await page.getByRole('dialog').isVisible()).toMatchInlineSnapshot(
        'false',
      )
      await page.getByRole('button', { name: 'Open menu' }).click()
      await page.setViewportSize({ width: 1024, height: 900 })
      await page.locator('#docs-menu').waitFor({ state: 'hidden' })
      expect(await page.getByRole('dialog').isVisible()).toMatchInlineSnapshot(
        'false',
      )
      expect(
        await page.getByRole('button', { name: 'Open menu' }).isVisible(),
      ).toMatchInlineSnapshot('false')
      expect(
        await page.getByRole('searchbox', { name: 'Search docs' }).isVisible(),
      ).toMatchInlineSnapshot('true')
    } finally {
      await browser.close()
    }
  }, 15000)

  test('restores framework and mode from shared URLs and browser history', async () => {
    const shared = `${origin}/docs/introduction/getting-started?framework=nextjs&mode=custom`
    const html = await (await fetch(shared)).text()
    expect(html.includes('Configure Next.js')).toMatchInlineSnapshot('true')
    expect(html.includes('Define Config')).toMatchInlineSnapshot('true')
    expect(html.includes('Add the Vite Plugin')).toMatchInlineSnapshot('false')

    const invalid = await (
      await fetch(
        `${origin}/docs/introduction/getting-started?framework=unknown&mode=unknown`,
      )
    ).text()
    expect(invalid.includes('Add the Vite Plugin')).toMatchInlineSnapshot(
      'true',
    )
    expect(invalid.includes('Define Config')).toMatchInlineSnapshot('false')

    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.goto(shared)
      await page.waitForLoadState('networkidle')
      await page
        .getByRole('button', {
          name: 'Default Variables (Quick)',
          exact: false,
        })
        .click()
      await page.waitForURL('**mode=default')
      expect(
        new URL(page.url()).searchParams.get('framework'),
      ).toMatchInlineSnapshot('"nextjs"')
      await page.reload()
      await page.waitForLoadState('networkidle')
      expect(
        await page
          .getByRole('heading', { name: 'Configure Next.js', exact: true })
          .count(),
      ).toMatchInlineSnapshot('1')
      expect(
        await page
          .getByRole('heading', { name: 'Define Config', exact: true })
          .count(),
      ).toMatchInlineSnapshot('0')

      await page.goBack()
      await page.waitForURL('**mode=custom')
      await page
        .getByRole('heading', { name: 'Define Config', exact: true })
        .waitFor()
      expect(
        await page
          .getByRole('heading', { name: 'Define Config', exact: true })
          .count(),
      ).toMatchInlineSnapshot('1')

      await page
        .getByRole('button', { name: 'React Native', exact: false })
        .click()
      await page.waitForURL('**framework=react-native**')
      expect(
        new URL(page.url()).searchParams.get('mode'),
      ).toMatchInlineSnapshot('"custom"')
      await page.reload()
      await page
        .getByRole('heading', { name: 'Configure Metro', exact: true })
        .waitFor()
      expect(
        await page
          .getByRole('button', {
            name: 'Default Variables (Quick)',
            exact: false,
          })
          .isDisabled(),
      ).toMatchInlineSnapshot('true')
    } finally {
      await browser.close()
    }
  }, 15000)

  test('redirects the docs entry and rejects unpublished pages', async () => {
    const response = await fetch(`${origin}/docs`, { redirect: 'manual' })
    const unknown = await fetch(`${origin}/docs/api/missing`)

    expect(response.status).toMatchInlineSnapshot('307')
    expect(response.headers.get('location')).toMatchInlineSnapshot(
      '"/docs/introduction/getting-started"',
    )
    expect(unknown.status).toMatchInlineSnapshot('404')
  })

  test('serves Markdown twins and negotiates agent requests', async () => {
    for (const [suffix, headers] of [
      ['.md', {}],
      ['', { accept: 'text/markdown' }],
      ['', { 'user-agent': 'ChatGPT-User/2.0' }],
      ['', { 'user-agent': 'curl/8.0' }],
    ] as const) {
      const response = await fetch(
        `${origin}/docs/introduction/getting-started${suffix}`,
        { headers },
      )
      const markdown = await response.text()

      expect(response.status).toMatchInlineSnapshot('200')
      expect(response.headers.get('content-type')).toMatchInlineSnapshot(
        '"text/markdown; charset=utf-8"',
      )
      expect(response.headers.get('vary')).toMatchInlineSnapshot(
        '"Accept, User-Agent"',
      )
      expect(markdown.startsWith('# Getting Started')).toMatchInlineSnapshot(
        'true',
      )
      expect(markdown.includes('```tsx')).toMatchInlineSnapshot('true')
      expect(
        markdown.includes('```sh\nnpm install zyzz\n```'),
      ).toMatchInlineSnapshot('true')
      expect(markdown.includes('<Steps>')).toMatchInlineSnapshot('false')
      expect(
        markdown.includes(
          'Read zyzz.sh and help me build my project with Zyzz.',
        ),
      ).toMatchInlineSnapshot('true')
      expect(
        markdown.includes('[Explore Variables](/vars)'),
      ).toMatchInlineSnapshot('true')
      expect(
        markdown.includes(
          '[Style Components](https://github.com/wevm/zyzz/blob/main/docs/guides/styling.md#style-components)',
        ),
      ).toMatchInlineSnapshot('true')
      expect(
        markdown.includes('For literal values without a theme'),
      ).toMatchInlineSnapshot('true')
      expect(markdown.includes('Color scheme')).toMatchInlineSnapshot('false')
    }
  })

  test('keeps HTML for search crawlers and link previews', async () => {
    for (const agent of ['Googlebot', 'Slackbot']) {
      const response = await fetch(
        `${origin}/docs/introduction/getting-started`,
        { headers: { accept: 'text/markdown', 'user-agent': agent } },
      )
      expect(
        response.headers.get('content-type')?.includes('text/html'),
      ).toMatchInlineSnapshot('true')
    }
    const preview = await fetch(
      `${origin}/docs/introduction/getting-started.md`,
      { headers: { 'user-agent': 'Slackbot' } },
    )
    expect(preview.status).toMatchInlineSnapshot('200')
    expect(
      (await preview.text()).includes('<h1>Getting Started</h1>'),
    ).toMatchInlineSnapshot('true')

    const response = await fetch(
      `${origin}/docs/introduction/getting-started`,
      { method: 'HEAD', headers: { accept: 'text/markdown' } },
    )
    expect(response.headers.get('content-type')).toMatchInlineSnapshot(
      '"text/markdown; charset=utf-8"',
    )
    expect(await response.text()).toMatchInlineSnapshot('""')
  })
})
