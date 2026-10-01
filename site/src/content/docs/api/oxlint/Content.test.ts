/** Verifies the linting guide's examples, HTTP content, and responsive rendering. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs'
import * as Module from 'node:module'
import * as Os from 'node:os'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test'
import { Source } from 'zyzz/compiler'
import { Css } from 'zyzz/web'

const guide = Fs.readFileSync(new URL('../oxlint.mdx', import.meta.url), 'utf8')
const blocks = Array.from(guide.matchAll(/```(\w+)[^\n]*\n([\s\S]*?)```/g))
const directory = Fs.realpathSync(
  Fs.mkdtempSync(`${Os.tmpdir()}/zyzz-linting-guide-`),
)
const origin = 'http://localhost:33339'
const require = Module.createRequire(import.meta.url)
const root = Path.resolve(import.meta.dirname, '../../../../../..')
const site = new URL('../../../../..', import.meta.url)
let server: ChildProcess.ChildProcess

describe('linting guide examples', () => {
  test('compiles all documented styles through the public CSS pipeline', () => {
    const sources = blocks.filter(
      (block) =>
        ['ts', 'tsx'].includes(block[1]!) && !block[2]!.includes('vite-plus'),
    )

    const css = sources.map((block, index) => {
      const extracted = Source.extract({
        moduleId: `Example${index}.tsx`,
        source: block[2]!,
      })
      return Css.compile({ styles: extracted.styles }).css
    })

    expect(sources).toHaveLength(5)
    expect(css.every((output) => output.length > 0)).toBe(true)
    expect(css[0]).toContain('color:red!important;')
    expect(css[0]).toContain('display:block;display:flex;')
    expect(css[3]).toContain('margin-inline-start:16px;')
    expect(css[3]).toContain('padding-inline-end:8px;')
    expect(css[4]).toContain('left:0px;')
  })

  test('loads authored configs and reports the documented unused definition', () => {
    const fixture = Path.join(directory, 'consumer')
    Fs.mkdirSync(Path.join(fixture, 'node_modules'), { recursive: true })
    Fs.symlinkSync(root, Path.join(fixture, 'node_modules/zyzz'), 'dir')
    Fs.writeFileSync(Path.join(fixture, 'package.json'), '{"type":"module"}')
    const configs = blocks.filter((block) => block[1] === 'json')
    const sources = blocks.filter(
      (block) =>
        ['ts', 'tsx'].includes(block[1]!) && !block[2]!.includes('vite-plus'),
    )
    for (const name of ['@types', 'react', 'vite-plus'])
      Fs.symlinkSync(
        Path.join(root, 'node_modules', name),
        Path.join(fixture, 'node_modules', name),
        'dir',
      )
    const examples = blocks.filter((block) => ['ts', 'tsx'].includes(block[1]!))
    const files = examples.map((block, index) => {
      const file = Path.join(fixture, `Example${index}.tsx`)
      Fs.writeFileSync(file, block[2]!)
      return file
    })

    const checked = ChildProcess.spawnSync(
      process.execPath,
      [
        Path.join(
          Path.dirname(require.resolve('typescript/package.json')),
          'bin/tsc',
        ),
        '--noEmit',
        '--strict',
        '--exactOptionalPropertyTypes',
        '--noUncheckedIndexedAccess',
        '--skipLibCheck',
        '--jsx',
        'react-jsx',
        '--module',
        'NodeNext',
        '--target',
        'ESNext',
        ...files,
      ],
      { cwd: fixture, encoding: 'utf8', timeout: 30000 },
    )

    expect(checked.status, checked.stdout + checked.stderr).toBe(0)

    const registration = JSON.parse(configs[0]![2]!)
    const binary = Path.join(
      Path.dirname(require.resolve('oxlint/package.json')),
      'bin/oxlint',
    )

    for (const block of configs) {
      const authored = JSON.parse(block[2]!)
      const config = {
        ...registration,
        ...authored,
        categories: { correctness: 'off' },
        rules: {
          'zyzz/no-conflicting-props': 'error',
          'zyzz/valid-styles': 'error',
          ...authored.rules,
        },
      }
      Fs.writeFileSync(
        Path.join(fixture, '.oxlintrc.json'),
        JSON.stringify(config),
      )
      Fs.writeFileSync(
        Path.join(fixture, 'source.tsx'),
        sources[1]![2]!.replace("padding: '16px'", "padding: '4px'"),
      )

      const result = ChildProcess.spawnSync(
        process.execPath,
        [binary, '-c', '.oxlintrc.json', '--format', 'json', 'source.tsx'],
        { cwd: fixture, encoding: 'utf8', timeout: 30000 },
      )

      expect(result.status, result.stderr).toBe(0)
      expect(JSON.parse(result.stdout).diagnostics).toEqual([])
    }

    Fs.writeFileSync(Path.join(fixture, 'vite.config.ts'), examples[0]![2]!)
    Fs.writeFileSync(Path.join(fixture, 'source.tsx'), sources[1]![2]!)

    const vite = ChildProcess.spawnSync(
      process.execPath,
      [
        Path.join(root, 'node_modules/vite-plus/bin/vp'),
        'lint',
        '--format',
        'json',
        'source.tsx',
      ],
      { cwd: fixture, encoding: 'utf8', timeout: 30000 },
    )

    expect(vite.status, vite.stdout + vite.stderr).toBe(0)
    expect(JSON.parse(vite.stdout).diagnostics).toEqual([])

    Fs.writeFileSync(
      Path.join(fixture, '.oxlintrc.json'),
      JSON.stringify({ ...registration, categories: { correctness: 'off' } }),
    )
    Fs.writeFileSync(Path.join(fixture, 'source.tsx'), sources[2]![2]!)

    const result = ChildProcess.spawnSync(
      process.execPath,
      [binary, '-c', '.oxlintrc.json', '--format', 'json', 'source.tsx'],
      { cwd: fixture, encoding: 'utf8', timeout: 30000 },
    )
    const diagnostics = JSON.parse(result.stdout).diagnostics

    expect(result.status, result.stderr).toBe(0)
    expect(
      diagnostics.map((diagnostic: { message: string }) => diagnostic.message),
    ).toEqual(["Style 'styles.unused' is never used."])
  }, 60000)
})

describe('/docs/api/oxlint', () => {
  beforeAll(async () => {
    const preview = Path.join(directory, 'site')
    Fs.cpSync(new URL('src', site), `${preview}/src`, { recursive: true })
    for (const file of [
      'package.json',
      'tsconfig.json',
      'tsr.config.json',
      'wrangler.jsonc',
    ])
      Fs.copyFileSync(new URL(file, site), `${preview}/${file}`)
    const config = Fs.readFileSync(new URL('vite.config.ts', site), 'utf8')
    Fs.writeFileSync(
      `${preview}/vite.config.ts`,
      config.replace('cloudflare({', 'cloudflare({ inspectorPort: false,'),
    )
    Fs.symlinkSync(
      new URL('node_modules', site),
      `${preview}/node_modules`,
      'dir',
    )
    server = ChildProcess.spawn(
      'node',
      [
        '--input-type=module',
        '-e',
        `import { createServer } from 'vite'; const server = await createServer({ cacheDir: ${JSON.stringify(`${preview}/.vite`)}, server: { port: 33339, strictPort: true, fs: { allow: ${JSON.stringify([directory, root])} } } }); await server.listen();`,
      ],
      { cwd: preview, detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let output = ''
    server.stdout?.on('data', (data) => {
      output += data
    })
    server.stderr?.on('data', (data) => {
      output += data
    })
    for (let attempt = 0; attempt < 360; attempt++) {
      if (server.exitCode !== null) throw new Error(output)
      try {
        if ((await fetch(`${origin}/docs/api/oxlint`)).ok) return
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error(`Linting preview did not start. ${output}`)
  }, 120000)

  test('preserves headings, paragraphs, links, and code in HTML and Markdown', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.goto(`${origin}/docs/api/oxlint`)
      const article = page.locator('article')
      const response = await fetch(`${origin}/docs/api/oxlint.md`)
      const markdown = await response.text()
      const headings = Array.from(
        markdown.matchAll(/^#{1,3} (.+)$/gm),
        (match) => match[1],
      )
      const code = Array.from(
        markdown.matchAll(/```\w*[^\n]*\n([\s\S]*?)```/g),
        (match) => match[1]!.trim(),
      )
      const links = Array.from(
        markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g),
        (match) => match[1],
      )
      const paragraphs = markdown
        .replace(/```[\s\S]*?```/g, '')
        .split(/\n\s*\n/)
        .filter((paragraph) => !paragraph.startsWith('#'))
        .map((paragraph) =>
          paragraph
            .replace(/^> ?/gm, '')
            .replace(/\\?\[!NOTE\]/g, '')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/`/g, '')
            .replace(/\s+/g, ' ')
            .trim(),
        )
        .filter(Boolean)

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/markdown')
      expect(await page.title()).toBe('Linting · Zyzz')
      expect(await article.locator('h1, h2, h3').allTextContents()).toEqual(
        headings,
      )
      expect(
        (await article.locator('pre code').allTextContents()).map((value) =>
          value.trim(),
        ),
      ).toEqual(code)
      expect(code).toEqual(blocks.map((block) => block[2]!.trim()))
      expect(
        await article
          .locator('a')
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute('href')),
          ),
      ).toEqual(links)
      for (const link of links.filter((href) => href?.startsWith('#')))
        expect(await article.locator(link!).count()).toBe(1)
      const text = (await article.innerText()).replace(/\s+/g, ' ')
      for (const paragraph of paragraphs) expect(text).toContain(paragraph)
      expect(
        await page
          .getByRole('navigation', { name: 'Documentation' })
          .getByRole('link', { name: 'Linting', exact: true })
          .getAttribute('aria-current'),
      ).toBe('page')
      for (const suffix of ['', '.md']) {
        const negotiated = await fetch(`${origin}/docs/api/oxlint${suffix}`, {
          headers: { accept: 'text/markdown' },
        })
        expect(await negotiated.text()).toBe(markdown)
      }
    } finally {
      await browser.close()
    }
  }, 30000)

  test('fits each viewport in light and dark schemes', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      for (const scheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: scheme })
        for (const width of [390, 768, 1440]) {
          await page.setViewportSize({ width, height: 1000 })
          await page.goto(`${origin}/docs/api/oxlint`)
          await page.waitForLoadState('networkidle')
          if (width < 1024)
            await page.getByRole('button', { name: 'Open menu' }).click()
          await page
            .getByRole('button', {
              name: scheme === 'light' ? 'Light' : 'Dark',
              exact: true,
            })
            .click()
          if (width < 1024) {
            const menu = page.getByRole('dialog', {
              name: 'Documentation menu',
            })
            await menu.getByRole('button', { name: 'Close menu' }).click()
            await menu.waitFor({ state: 'hidden' })
          }
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          ).toBe(true)
          expect(
            await page
              .locator('article')
              .evaluate((element) => getComputedStyle(element).colorScheme),
          ).toBe(scheme)
          expect(await page.locator('article [data-step]').count()).toBe(3)
          if (process.env.ZYZZ_DOCS_SCREENSHOTS) {
            Fs.mkdirSync(process.env.ZYZZ_DOCS_SCREENSHOTS, { recursive: true })
            await page.screenshot({
              path: Path.join(
                process.env.ZYZZ_DOCS_SCREENSHOTS,
                `oxlint-${width}-${scheme}.png`,
              ),
              fullPage: true,
            })
          }
        }
      }
    } finally {
      await browser.close()
    }
  }, 60000)
})

afterAll(async () => {
  if (server?.pid && server.exitCode === null) {
    const exited = new Promise((resolve) => server.once('exit', resolve))
    process.kill(-server.pid, 'SIGTERM')
    await exited
  }
  Fs.rmSync(directory, { recursive: true, force: true })
})
