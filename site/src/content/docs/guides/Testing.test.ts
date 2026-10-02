/** Exercises Testing guide content and responsive layout in a browser. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs'
import * as Os from 'node:os'
import { buildSync } from 'esbuild'
import { type Browser, chromium, type Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'

const origin = process.env.ZYZZ_TEST_ORIGIN ?? 'http://localhost:33336'
let server: ChildProcess.ChildProcess
const directory = Fs.realpathSync(
  Fs.mkdtempSync(`${Os.tmpdir()}/zyzz-docs-test-`),
)
const site = new URL('../../../..', import.meta.url)

describe('/docs/guides/testing', () => {
  let browser: Browser
  let page: Page

  beforeAll(async () => {
    if (process.env.ZYZZ_TEST_ORIGIN) return

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
    server = ChildProcess.spawn(
      'node',
      [
        '--input-type=module',
        '-e',
        `import { createServer } from 'vite'; const server = await createServer({ cacheDir: ${JSON.stringify(`${directory}/.vite`)}, server: { port: 33336, strictPort: true, fs: { allow: ${JSON.stringify([directory, Fs.realpathSync(new URL('../../../../..', import.meta.url))])} } } }); await server.listen();`,
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
    for (let attempt = 0; attempt < 400; attempt++) {
      if (server.exitCode !== null) throw new Error(output)
      try {
        if (
          (
            await fetch(`${origin}/docs/guides/testing`, {
              signal: AbortSignal.timeout(2000),
            })
          ).ok
        )
          return
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error(`Documentation site did not start. ${output}`)
  }, 120000)

  beforeAll(async () => {
    browser = await chromium.launch()
    page = await browser.newPage({
      colorScheme: 'light',
      viewport: { height: 1000, width: 390 },
    })
    await page.goto(`${origin}/docs/guides/testing`)
    await page.waitForFunction(
      () => {
        const pre = document.querySelector('article pre')
        return pre && getComputedStyle(pre).overflowX === 'auto'
      },
      undefined,
      { timeout: 60_000 },
    )
    await page.evaluate(() => document.fonts.ready)
  }, 120000)

  afterAll(async () => {
    await browser?.close()
    if (server?.pid && server.exitCode === null) {
      const exited = new Promise((resolve) => server.once('exit', resolve))
      process.kill(-server.pid, 'SIGTERM')
      await exited
    }
    Fs.rmSync(directory, { recursive: true, force: true })
  })

  test('retains prose, headings, links, and examples through Markdown delivery', async () => {
    const response = await fetch(`${origin}/docs/guides/testing.md`)
    const negotiated = await fetch(`${origin}/docs/guides/testing`, {
      headers: { Accept: 'text/markdown' },
    })
    expect(response.status).toBe(200)
    expect(negotiated.status).toBe(200)
    const markdown = await response.text()
    expect(await negotiated.text()).toBe(markdown)

    const headings = await page
      .locator('article h2, article h3')
      .allTextContents()
    for (const heading of headings) expect(markdown).toContain(heading)
    const blocks = await page.locator('article pre code').allTextContents()
    expect(blocks).toHaveLength(5)
    for (const block of blocks) expect(markdown).toContain(block.trim())
    const paragraphs = await page
      .locator('article p, article li')
      .allTextContents()
    const prose = markdown
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[`*]/g, '')
    for (const paragraph of paragraphs) expect(prose).toContain(paragraph)
    const links = await page
      .locator('article a[href]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')))
    for (const link of links) expect(markdown).toContain(`(${link})`)
    expect(markdown).toContain('](/docs/api/oxlint)')
  })

  test('renders without page overflow in both schemes at each viewport', async () => {
    for (const width of [390, 768, 1440]) {
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.setViewportSize({ width, height: 1000 })
        await page.emulateMedia({ colorScheme })
        await page.evaluate(() => document.fonts.ready)

        expect(
          await page.getByRole('heading', { level: 1 }).textContent(),
        ).toBe('Testing & Troubleshooting')
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true)
        if (process.env.ZYZZ_TEST_SCREENSHOTS) {
          Fs.mkdirSync(process.env.ZYZZ_TEST_SCREENSHOTS, { recursive: true })
          await page.screenshot({
            fullPage: true,
            path: `${process.env.ZYZZ_TEST_SCREENSHOTS}/${width}-${colorScheme}.png`,
          })
        }
      }
    }
  })
})

test('compiles the component examples and renders their intended styles', async () => {
  const source = Fs.readFileSync(
    new URL('./testing.mdx', import.meta.url),
    'utf8',
  )
  const examples = [...source.matchAll(/```tsx[^\n]*\n(.*?)\n```/gs)]
  expect(examples).toHaveLength(2)
  const browser = await chromium.launch()

  try {
    for (const [index, example] of examples.entries()) {
      const component = index === 0 ? '<SaveButton disabled />' : '<Card />'
      const output = Transform.compile({
        moduleId: `testing/example-${index}.tsx`,
        source: `${example[1]}
import { createRoot } from 'react-dom/client'
createRoot(document.getElementById('root')!).render(${component})`,
      })
      const bundle = buildSync({
        bundle: true,
        format: 'iife',
        jsx: 'automatic',
        stdin: {
          contents: output.code,
          loader: 'tsx',
          resolveDir: Fs.realpathSync(
            new URL('../../../../..', import.meta.url),
          ),
        },
        write: false,
      })
      const page = await browser.newPage()
      await page.setContent('<div id="root"></div>')
      await page.addStyleTag({ content: output.css })
      await page.addScriptTag({ content: bundle.outputFiles[0]!.text })
      const element = page.locator(index === 0 ? 'button' : 'article')
      await element.waitFor()

      const computed = await element.evaluate((element) => {
        const style = getComputedStyle(element)
        return [
          style.backgroundColor,
          style.color,
          style.paddingTop,
          style.paddingInlineStart,
        ]
      })
      expect(computed).toEqual(
        index === 0
          ? ['rgb(128, 128, 128)', 'rgb(255, 255, 255)', '8px', '16px']
          : ['rgba(0, 0, 0, 0)', 'rgb(0, 0, 255)', '16px', '16px'],
      )
      await page.close()
    }
  } finally {
    await browser.close()
  }
})
