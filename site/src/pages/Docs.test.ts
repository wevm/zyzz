/** Exercises documentation routes through HTTP and browser behavior. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs'
import * as Os from 'node:os'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test'

const origin = 'http://localhost:3157'
let server: ChildProcess.ChildProcess
const directory = Fs.realpathSync(
  Fs.mkdtempSync(`${Os.tmpdir()}/zyzz-docs-test-`),
)
const site = new URL('../..', import.meta.url)
const fixture = `${directory}/src/content/docs/guides/navigation-review-fixture.mdx`
const outlineFixture = `${directory}/src/content/docs/guides/outline-review-fixture.mdx`
const twoslashFixture = `${directory}/src/content/docs/guides/twoslash-review-fixture.mdx`

describe('/docs', () => {
  beforeAll(async () => {
    Fs.cpSync(new URL('src', site), `${directory}/src`, { recursive: true })
    for (const file of [
      'package.json',
      'tsconfig.json',
      'tsr.config.json',
      'wrangler.jsonc',
    ])
      Fs.copyFileSync(new URL(file, site), `${directory}/${file}`)
    const config = Fs.readFileSync(new URL('vite.config.ts', site), 'utf8')
    Fs.writeFileSync(
      `${directory}/vite.config.ts`,
      config.replace('cloudflare({', 'cloudflare({ inspectorPort: false,'),
    )
    Fs.symlinkSync(
      new URL('node_modules', site),
      `${directory}/node_modules`,
      'dir',
    )
    Fs.mkdirSync(`${directory}/src/content/docs/guides`, { recursive: true })
    Fs.writeFileSync(
      fixture,
      'import { useEffect, useState } from "react"\n\nexport const example = true\n\nexport function Readiness() { const [ready, setReady] = useState(false); useEffect(() => setReady(true), []); return <span data-navigation-ready={ready} /> }\n\n# Navigation **Fixture**\n\nA [guide](/docs) used to verify `published` navigation.\n\n<Readiness />\n\n[Shared setup](/docs/introduction/getting-started?framework=nextjs&mode=custom)\n\n[Markdown](/docs/introduction/getting-started.md)\n\n<Card href="/docs/introduction/why-zyzz" title="Why Zyzz card">Read about Zyzz.</Card>\n',
    )
    Fs.writeFileSync(
      twoslashFixture,
      [
        '# Twoslash Fixture',
        '',
        'Code checked against the published Zyzz types.',
        '',
        '```ts twoslash title="errors.ts"',
        '// @errors: 2322',
        "import { defineConfig } from 'zyzz'",
        '',
        "const { style } = defineConfig({ vars: { spacing: { md: '1rem' } } })",
        '',
        "style({ padding: 'lg' })",
        '```',
        '',
        '```ts twoslash title="completions.ts" /padding/',
        '// @noErrors',
        "import { defineConfig } from 'zyzz'",
        '',
        "const { style } = defineConfig({ vars: { spacing: { md: '1rem' } } })",
        '',
        "style({ padding: '' })",
        '//                ^|',
        '```',
        '',
        '```ts twoslash title="lint.ts"',
        'export const zIndex = 9999',
        "  // @error: zyzz(restricted-properties): Property 'zIndex' is restricted.",
        '```',
        '',
        '```ts title="diff.ts"',
        "const size = 'sm' // [!code --]",
        "const size = 'md' // [!code ++]",
        "const tone = 'brand' // [!code hl]",
        '```',
        '',
        '```ts title="src/app/word.ts" /\'md\'/',
        "const size = 'md'",
        '```',
        '',
        '> [!TIP]',
        '> Fixture tip.',
        '>',
        '> ```ts',
        '> const tip = true',
        '> ```',
        '',
      ].join('\n'),
    )
    const filler = Array.from({ length: 12 }, () => 'Filler paragraph.\n')
    Fs.writeFileSync(
      outlineFixture,
      [
        '# Outline Fixture',
        '',
        'Sections listed beside the article.',
        '',
        '## Overview',
        '',
        ...filler,
        '### Details',
        '',
        ...filler,
        '<Steps>',
        '',
        '### Step Heading',
        '',
        'Step content.',
        '',
        '</Steps>',
        '',
        '## Overview',
        '',
        ...filler,
      ].join('\n'),
    )
    server = ChildProcess.spawn(
      'node',
      [
        '--input-type=module',
        '-e',
        `import { createServer } from 'vite'; const server = await createServer({ cacheDir: ${JSON.stringify(`${directory}/.vite`)}, server: { port: 3157, strictPort: true, fs: { allow: ${JSON.stringify([directory, Fs.realpathSync(new URL('../../..', import.meta.url))])} } } }); await server.listen();`,
      ],
      {
        cwd: directory,
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
    for (let attempt = 0; attempt < 480; attempt++) {
      if (server.exitCode !== null) throw new Error(output)
      try {
        if ((await fetch(`${origin}/docs/introduction/getting-started`)).ok)
          return
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error(`Documentation site did not start. ${output}`)
  }, 150000)

  afterAll(async () => {
    if (server?.pid && server.exitCode === null) {
      const exited = new Promise((resolve) => server.once('exit', resolve))
      process.kill(-server.pid, 'SIGTERM')
      await exited
    }
    Fs.rmSync(directory, { recursive: true, force: true })
  })

  test('lists published guides in sidebar navigation', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage({
        viewport: { width: 1400, height: 900 },
      })
      await page.goto(`${origin}/docs/guides/navigation-review-fixture`)
      expect(await page.getByRole('heading', { level: 1 }).allTextContents())
        .toMatchInlineSnapshot(`
        [
          "Navigation Fixture",
        ]
      `)
      expect(await page.title()).toMatchInlineSnapshot(
        '"Navigation Fixture · Zyzz"',
      )
      expect(
        await page.locator('meta[name="description"]').getAttribute('content'),
      ).toMatchInlineSnapshot('"A guide used to verify published navigation."')
      expect(
        await page
          .getByText('A guide used to verify published navigation.', {
            exact: true,
          })
          .count(),
      ).toMatchInlineSnapshot('1')
      const navigation = page.getByRole('navigation', { name: 'Documentation' })
      expect(
        await navigation
          .getByRole('heading', { name: 'Guides', exact: true })
          .count(),
      ).toMatchInlineSnapshot('1')
      expect(
        await navigation
          .getByRole('link', { name: 'Navigation Fixture' })
          .getAttribute('aria-current'),
      ).toMatchInlineSnapshot('"page"')
      expect(await navigation.getByRole('heading').allTextContents())
        .toMatchInlineSnapshot(`
        [
          "Introduction",
          "Guides",
          "API",
        ]
      `)
      expect(
        await navigation
          .getByRole('link', { name: 'Installation', exact: true })
          .count(),
      ).toMatchInlineSnapshot('0')
      expect(
        await navigation
          .getByRole('link', { name: 'Default Variables', exact: true })
          .count(),
      ).toMatchInlineSnapshot('0')
      // Nested topics stay collapsed unless they contain the current page.
      // Each topic is a `details` element whose `summary` has no implicit role.
      const vite = navigation.getByRole('link', { name: 'Vite', exact: true })
      expect(await vite.isVisible()).toMatchInlineSnapshot('false')
      await navigation.locator('summary', { hasText: 'Integrations' }).click()
      expect(await vite.isVisible()).toMatchInlineSnapshot('true')
      expect(await vite.getAttribute('href')).toMatchInlineSnapshot(
        '"/docs/api/vite"',
      )
      expect(
        await navigation
          .getByRole('link', { name: 'Getting Started', exact: true })
          .getAttribute('href'),
      ).toMatchInlineSnapshot('"/docs/introduction/getting-started"')
    } finally {
      await browser.close()
    }
  })

  test('groups core API exports under labelled sections', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage({
        viewport: { width: 1400, height: 900 },
      })
      await page.goto(`${origin}/docs/api/core/style`)
      const navigation = page.getByRole('navigation', { name: 'Documentation' })
      const core = navigation.locator('details', {
        has: page.getByRole('group', { name: 'Authoring' }),
      })

      // The topic opens because it contains the current page.
      expect(await core.getAttribute('open')).toMatchInlineSnapshot('""')
      expect(
        await core
          .getByRole('group')
          .evaluateAll((groups) =>
            groups.map((group) => group.firstElementChild?.textContent),
          ),
      ).toMatchInlineSnapshot(`
        [
          "Authoring",
          "Configuration",
          "Config Helpers",
          "Namespaces",
          "Reference",
        ]
      `)
      expect(
        await core
          .getByRole('link', { name: 'Overview', exact: true })
          .getAttribute('href'),
      ).toMatchInlineSnapshot('"/docs/api/core"')

      const authoring = core.getByRole('group', { name: 'Authoring' })
      expect(
        await authoring
          .getByRole('link', { name: 'style', exact: true })
          .getAttribute('aria-current'),
      ).toMatchInlineSnapshot('"page"')
      // Every Core export has a page, so no entry renders as under construction.
      expect(
        await core
          .getByRole('link')
          .evaluateAll((links) =>
            links.map((link) => link.getAttribute('href') ?? 'disabled'),
          ),
      ).toMatchInlineSnapshot(`
        [
          "/docs/api/core",
          "/docs/api/core/style",
          "/docs/api/core/variants",
          "/docs/api/core/cx",
          "/docs/api/core/variable",
          "/docs/api/core/defineConfig",
          "/docs/api/core/defineVars",
          "/docs/api/core/extendVars",
          "/docs/api/core/defineConfig/vars",
          "/docs/api/core/defineConfig/appearance",
          "/docs/api/core/defineConfig/script",
          "/docs/api/core/namespaces/Config",
          "/docs/api/core/namespaces/Props",
          "/docs/api/core/namespaces/Style",
          "/docs/api/core/namespaces/Vars",
          "/docs/api/core/values",
        ]
      `)
      expect(await navigation.getByRole('heading').allTextContents())
        .toMatchInlineSnapshot(`
        [
          "Introduction",
          "Guides",
          "API",
        ]
      `)
    } finally {
      await browser.close()
    }
  })

  test('spans the viewport and outlines page sections beside the article', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage({
        viewport: { width: 1400, height: 900 },
      })
      await page.goto(`${origin}/docs/guides/outline-review-fixture`)
      await page.waitForLoadState('networkidle')
      const outline = page.getByRole('navigation', { name: 'On this page' })

      expect(
        await page
          .locator('main')
          .evaluate((node) => node.getBoundingClientRect().width),
      ).toMatchInlineSnapshot('1400')
      expect(
        await outline
          .getByRole('link')
          .evaluateAll((links) =>
            links.map(
              (link) => `${link.textContent} ${link.getAttribute('href')}`,
            ),
          ),
      ).toMatchInlineSnapshot(`
        [
          "Overview #overview",
          "Details #details",
          "Overview #overview-1",
        ]
      `)
      expect(
        await page.locator('#details').evaluate((node) => node.tagName),
      ).toMatchInlineSnapshot('"H3"')
      expect(
        await outline.locator('[aria-current]').count(),
      ).toMatchInlineSnapshot('0')

      await outline.getByRole('link', { name: 'Details' }).click()
      await page.waitForFunction(
        () =>
          document.querySelector('[aria-current="location"]')?.textContent ===
          'Details',
      )
      expect(new URL(page.url()).hash).toMatchInlineSnapshot('"#details"')
      expect(
        await page
          .locator('#details')
          .evaluate((node) => node.getBoundingClientRect().top),
      ).toMatchInlineSnapshot('96')

      // The final section is too short to reach the header, so the page end selects it.
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      )
      await page.waitForFunction(
        () =>
          document
            .querySelector('[aria-current="location"]')
            ?.getAttribute('href') === '#overview-1',
      )
      expect(
        await outline.locator('[aria-current]').count(),
      ).toMatchInlineSnapshot('1')

      await page.setViewportSize({ width: 1279, height: 900 })
      expect(await outline.isVisible()).toMatchInlineSnapshot('false')
      await page.setViewportSize({ width: 1280, height: 900 })
      expect(await outline.isVisible()).toMatchInlineSnapshot('true')

      // Wide viewports cap the article at its text width and center it between equal gutters.
      await page.setViewportSize({ width: 2000, height: 900 })
      expect(
        await page
          .locator('article')
          .evaluate((node) => node.getBoundingClientRect().width),
      ).toMatchInlineSnapshot('864')
      expect(
        await page
          .locator('main aside')
          .first()
          .evaluate((node) => node.getBoundingClientRect().left),
      ).toMatchInlineSnapshot('316')
      expect(
        await page
          .locator('article + aside')
          .evaluate((node) => node.getBoundingClientRect().left),
      ).toMatchInlineSnapshot('1433')
      expect(
        await page
          .locator('article + aside')
          .evaluate(
            (node) => window.innerWidth - node.getBoundingClientRect().right,
          ),
      ).toMatchInlineSnapshot('315')
    } finally {
      await browser.close()
    }
  })

  test('switches documentation pages without reloading and restores shared setup through history', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage({
        viewport: { width: 1400, height: 900 },
      })
      await page.goto(`${origin}/docs/guides/navigation-review-fixture`)
      await page
        .locator('[data-navigation-ready="true"]')
        .waitFor({ state: 'attached' })
      const timeOrigin = await page.evaluate(() => performance.timeOrigin)
      const documents: string[] = []
      page.on('request', (request) => {
        if (
          request.isNavigationRequest() &&
          request.frame() === page.mainFrame()
        )
          documents.push(request.url())
      })

      expect(
        await page
          .getByRole('link', { name: 'Markdown', exact: true })
          .getAttribute('href'),
      ).toMatchInlineSnapshot('"/docs/introduction/getting-started.md"')
      await page
        .getByRole('link', { name: 'Shared setup', exact: true })
        .focus()
      await page.keyboard.press('Enter')
      await page
        .getByRole('heading', { name: 'Configure Next.js', exact: true })
        .waitFor()
      expect(
        new URL(page.url()).searchParams.get('framework'),
      ).toMatchInlineSnapshot('"nextjs"')
      expect(
        new URL(page.url()).searchParams.get('mode'),
      ).toMatchInlineSnapshot('"custom"')
      expect(
        await page
          .getByRole('heading', { name: 'Define Config', exact: true })
          .count(),
      ).toMatchInlineSnapshot('1')

      await page
        .locator('aside')
        .getByRole('link', { name: 'Why Zyzz', exact: true })
        .click()
      await page
        .getByRole('heading', { level: 1, name: 'Why Zyzz', exact: true })
        .waitFor()
      expect(await page.title()).toMatchInlineSnapshot('"Why Zyzz · Zyzz"')
      expect(
        await page
          .locator('aside')
          .getByRole('link', { name: 'Why Zyzz', exact: true })
          .getAttribute('aria-current'),
      ).toMatchInlineSnapshot('"page"')

      await page.goBack()
      await page
        .getByRole('heading', { name: 'Configure Next.js', exact: true })
        .waitFor()
      expect(
        await page
          .getByRole('heading', { name: 'Define Config', exact: true })
          .count(),
      ).toMatchInlineSnapshot('1')
      await page.goBack()
      await page
        .getByRole('heading', { level: 1, name: 'Navigation Fixture' })
        .waitFor()
      await page
        .getByRole('link', { name: 'Why Zyzz card', exact: false })
        .click()
      await page
        .getByRole('heading', { level: 1, name: 'Why Zyzz', exact: true })
        .waitFor()

      await page.getByRole('link', { name: 'Variables', exact: true }).click()
      await page.waitForFunction(() => document.title === 'Variables · Zyzz')
      await page.getByRole('link', { name: 'Zyzz home', exact: true }).click()
      await page
        .getByRole('heading', {
          name: 'Universal styles for modern interfaces',
        })
        .waitFor()
      await page.getByRole('link', { name: 'Docs', exact: true }).click()
      await page
        .getByRole('heading', { level: 1, name: 'Getting Started' })
        .waitFor()
      await page
        .locator('aside')
        .getByRole('link', { name: 'Why Zyzz', exact: true })
        .click()
      await page
        .getByRole('heading', { level: 1, name: 'Why Zyzz', exact: true })
        .waitFor()

      await page.setViewportSize({ width: 390, height: 900 })
      await page.getByRole('button', { name: 'Open menu' }).click()
      const menu = page.getByRole('dialog', { name: 'Documentation menu' })
      await menu
        .getByRole('link', { name: 'Getting Started', exact: true })
        .click()
      await page
        .getByRole('heading', { level: 1, name: 'Getting Started' })
        .waitFor()
      await menu.waitFor({ state: 'hidden' })
      expect(await menu.isVisible()).toMatchInlineSnapshot('false')
      await page.waitForFunction(() => document.body.style.overflow === '')
      expect(
        await page.evaluate(() => document.body.style.overflow),
      ).toMatchInlineSnapshot('""')
      await page.goBack()
      await page
        .getByRole('heading', { level: 1, name: 'Why Zyzz', exact: true })
        .waitFor()
      await page.goForward()
      await page
        .getByRole('heading', { level: 1, name: 'Getting Started' })
        .waitFor()

      expect(
        (await page.evaluate(() => performance.timeOrigin)) === timeOrigin,
      ).toMatchInlineSnapshot('true')
      expect(documents).toMatchInlineSnapshot('[]')
    } finally {
      await browser.close()
    }
  }, 60000)

  test('reserves two lines and clips overflow for every documentation card', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.goto(`${origin}/docs/introduction/getting-started`)
      await page.waitForLoadState('networkidle')
      for (const width of [390, 768, 1400]) {
        await page.setViewportSize({ width, height: 1000 })
        const descriptions = await page
          .locator('[data-card] > div')
          .evaluateAll((nodes) =>
            nodes.map((node) => {
              const styles = getComputedStyle(node)
              return {
                lines:
                  node.getBoundingClientRect().height /
                  Number.parseFloat(styles.lineHeight),
                overflow: styles.overflow,
              }
            }),
          )
        expect(descriptions.length).toMatchInlineSnapshot('12')
        expect(
          descriptions.every((entry) => entry.lines === 2),
        ).toMatchInlineSnapshot('true')
        expect(
          descriptions.every((entry) => entry.overflow === 'hidden'),
        ).toMatchInlineSnapshot('true')
      }
    } finally {
      await browser.close()
    }
  }, 15000)

  test('announces a denied code-copy request', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      const protocol = await browser.newBrowserCDPSession()
      const contexts = await protocol.send('Target.getBrowserContexts')
      for (const allowWithoutSanitization of [false, true]) {
        await protocol.send('Browser.setPermission', {
          permission: { name: 'clipboard-write', allowWithoutSanitization },
          setting: 'denied',
          origin,
          browserContextId: contexts.browserContextIds[0]!,
        })
      }
      await page.goto(`${origin}/docs/introduction/getting-started`)
      await page.waitForLoadState('networkidle')
      await page
        .getByRole('button', { name: 'Copy vite.config.ts', exact: true })
        .click()
      const alert = page.getByRole('alert')
      await alert.waitFor()
      expect(await alert.textContent()).toMatchInlineSnapshot(
        '"Could not copy code. Select and copy it manually."',
      )
    } finally {
      await browser.close()
    }
  }, 15000)

  test('renders Twoslash diagnostics, completions, notations, and callouts', async () => {
    const markdown = await (
      await fetch(`${origin}/docs/guides/twoslash-review-fixture.md`)
    ).text()
    expect(markdown).toMatchInlineSnapshot(`
      "# Twoslash Fixture

      Code checked against the published Zyzz types.

      \`\`\`ts title="errors.ts"
      import { defineConfig } from 'zyzz'

      const { style } = defineConfig({ vars: { spacing: { md: '1rem' } } })

      style({ padding: 'lg' })
      // error: Type '"lg"' is not assignable to type '"lg" & Expected<"md" | \`\${string} !custom\`>'.
      // Type 'string' is not assignable to type 'Expected<"md" | \`\${string} !custom\`>'.
      \`\`\`

      \`\`\`ts title="completions.ts"
      import { defineConfig } from 'zyzz'

      const { style } = defineConfig({ vars: { spacing: { md: '1rem' } } })

      style({ padding: '' })
      // completions: md
      \`\`\`

      \`\`\`ts title="lint.ts"
      export const zIndex = 9999
      // zyzz(restricted-properties): Property 'zIndex' is restricted.
      \`\`\`

      \`\`\`diff title="diff.ts"
      -const size = 'sm'
      +const size = 'md'
       const tone = 'brand'
      \`\`\`

      \`\`\`ts title="src/app/word.ts"
      const size = 'md'
      \`\`\`

      > [!TIP]
      > Fixture tip.
      >
      > \`\`\`ts
      > const tip = true
      > \`\`\`
      "
    `)

    const browser = await chromium.launch({ headless: true })
    try {
      const context = await browser.newContext({
        permissions: ['clipboard-read', 'clipboard-write'],
        reducedMotion: 'reduce',
      })
      const page = await context.newPage()
      await page.goto(`${origin}/docs/guides/twoslash-review-fixture`)
      await page.waitForLoadState('networkidle')

      expect(
        (
          await page.locator('.twoslash-error-line').first().textContent()
        )?.split('\n')[0],
      ).toMatchInlineSnapshot(
        `"Type '"lg"' is not assignable to type '"lg" & Expected<"md" | \`\${string} !custom\`>'."`,
      )
      expect(
        await page
          .locator('.twoslash-error')
          .first()
          .evaluate((node) => [
            node.textContent,
            getComputedStyle(node).textDecorationStyle,
          ]),
      ).toMatchInlineSnapshot(`
        [
          "padding",
          "wavy",
        ]
      `)

      expect(
        await page
          .getByRole('list', { name: 'Completions' })
          .getByRole('listitem')
          .allTextContents(),
      ).toMatchInlineSnapshot(`
        [
          "md",
        ]
      `)
      expect(
        await page
          .locator('.twoslash-completion-cursor')
          .evaluate((node) => getComputedStyle(node, '::before').animationName),
      ).toMatchInlineSnapshot('"none"')

      expect(
        await page.locator('.twoslash-tag-line').textContent(),
      ).toMatchInlineSnapshot(
        `"zyzz(restricted-properties): Property 'zIndex' is restricted."`,
      )

      expect(
        await page
          .locator('pre:has(.diff) .line')
          .evaluateAll((lines) =>
            lines.map((line) => [
              line.textContent,
              getComputedStyle(line, '::before').content,
              getComputedStyle(line).backgroundColor !== 'rgba(0, 0, 0, 0)',
            ]),
          ),
      ).toMatchInlineSnapshot(`
        [
          [
            "const size = 'sm'",
            ""-"",
            true,
          ],
          [
            "const size = 'md'",
            ""+"",
            true,
          ],
          [
            "const tone = 'brand'",
            "none",
            true,
          ],
        ]
      `)

      expect(await page.locator('.highlighted-word').allTextContents())
        .toMatchInlineSnapshot(`
        [
          "padding",
          "'md'",
        ]
      `)

      await page
        .getByRole('button', { name: 'Copy errors.ts', exact: true })
        .click()
      expect(await page.evaluate(() => navigator.clipboard.readText()))
        .toMatchInlineSnapshot(`
        "import { defineConfig } from 'zyzz'

        const { style } = defineConfig({ vars: { spacing: { md: '1rem' } } })

        style({ padding: 'lg' })"
      `)

      const note = page.getByRole('complementary', { name: 'Tip' })
      expect(
        (await note.locator('pre').textContent())?.trim(),
      ).toMatchInlineSnapshot('"const tip = true"')
      // A one-line block centers its copy button vertically.
      expect(
        await note.locator('pre').evaluate((node) => {
          const block = node.parentElement!.getBoundingClientRect()
          const button = node
            .parentElement!.querySelector('button')!
            .getBoundingClientRect()
          return (
            Math.abs(
              block.top + block.height / 2 - (button.top + button.height / 2),
            ) < 1
          )
        }),
      ).toMatchInlineSnapshot('true')
    } finally {
      await browser.close()
    }
  }, 15000)

  test('honors Markdown quality values while preserving agent and suffix precedence', async () => {
    for (const [accept, markdown] of [
      ['text/markdown;q=0, text/html', false],
      ['text/markdown;q=0, */*;q=1', false],
      ['text/markdown;q=0.4, text/html;q=0.8', false],
      ['text/markdown;q=0.4, text/*;q=0.8', false],
      ['text/markdown;q=0.9, text/html;q=0.4', true],
      ['text/markdown, text/html', true],
      ['text/markdown;q=invalid, text/html', false],
    ] as const) {
      const response = await fetch(
        `${origin}/docs/introduction/getting-started`,
        { headers: { accept, 'user-agent': 'Mozilla/5.0' } },
      )
      expect(response.status).toMatchInlineSnapshot('200')
      expect(
        response.headers.get('content-type')?.startsWith('text/markdown') ===
          markdown,
      ).toMatchInlineSnapshot('true')
    }
    for (const [suffix, agent] of [
      ['.md', 'Mozilla/5.0'],
      ['', 'ChatGPT-User/2.0'],
    ]) {
      const response = await fetch(
        `${origin}/docs/introduction/getting-started${suffix}`,
        {
          headers: {
            accept: 'text/markdown;q=0, text/html',
            'user-agent': agent!,
          },
        },
      )
      expect(response.headers.get('content-type')).toMatchInlineSnapshot(
        '"text/markdown; charset=utf-8"',
      )
    }
  })

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
    expect(html.includes('>Guides</h2>')).toMatchInlineSnapshot('true')
    expect(html.includes('>API</h2>')).toMatchInlineSnapshot('true')
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
    expect(html.includes('Configure Vite')).toMatchInlineSnapshot('true')
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
        ['Other Bundlers', 'Configure the Bundler'],
        ['CLI', 'Run the CLI'],
        ['Compiler API', 'Compile Programmatically'],
        ['Vite', 'Configure Vite'],
      ]) {
        // The sidebar's React Native topic is also a button, so search only the article.
        await page
          .locator('article')
          .getByRole('button', { name: title!, exact: false })
          .click()
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
    expect(html.includes('Configure Vite')).toMatchInlineSnapshot('false')

    const invalid = await (
      await fetch(
        `${origin}/docs/introduction/getting-started?framework=unknown&mode=unknown`,
      )
    ).text()
    expect(invalid.includes('Configure Vite')).toMatchInlineSnapshot('true')
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
        .locator('article')
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
    const installation = await fetch(`${origin}/docs/introduction/installation`)
    const markdown = await fetch(`${origin}/docs/introduction/installation.md`)

    expect(response.status).toMatchInlineSnapshot('307')
    expect(response.headers.get('location')).toMatchInlineSnapshot(
      '"/docs/introduction/getting-started"',
    )
    expect(unknown.status).toMatchInlineSnapshot('404')
    expect(installation.status).toMatchInlineSnapshot('404')
    expect(markdown.status).toMatchInlineSnapshot('404')
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
