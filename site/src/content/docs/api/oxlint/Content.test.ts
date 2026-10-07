/** Verifies the linting guide's examples, HTTP content, and responsive rendering. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs'
import * as Module from 'node:module'
import * as Os from 'node:os'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test'
import { Source } from 'zyzz/compiler'
import plugin from 'zyzz/oxlint'
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

const rules = guide
  .split('\n## Rules\n')[1]!
  .split('\n## ')[0]!
  .split('\n### ')
  .slice(1)
  .map((section) => {
    const code = (heading: string) =>
      section
        .split(`\n#### ${heading}\n`)[1]!
        .match(/```\w+[^\n]*\n([\s\S]*?)```/)![1]!

    return {
      correct: code('Correct'),
      id: section.split('\n')[0]!.toLowerCase().replaceAll(' ', '-'),
      incorrect: code('Incorrect'),
      options: section.match(/```json[^\n]*\n([\s\S]*?)```/)?.[1],
    }
  })

/** Removes Twoslash directives and lint annotations, leaving the authored source. */
function source(code: string) {
  return code
    .split('\n')
    .filter((line) => !/^\s*\/\/ @(error:|noErrors)/.test(line))
    .join('\n')
}

/** Removes highlight notations, which the rendered page and Markdown omit. */
function displayed(code: string) {
  return source(code)
    .split('\n')
    .filter((line) => !/^\s*\/\/ \[!code [^\]]+\]$/.test(line))
    .map((line) => line.replace(/ \/\/ \[!code [^\]]+\]$/, ''))
    .join('\n')
    .trim()
}

describe('linting guide examples', () => {
  test('compiles all documented styles through the public CSS pipeline', () => {
    const sources = blocks.filter(
      (block) =>
        ['ts', 'tsx'].includes(block[1]!) &&
        !block[2]!.includes('vite-plus') &&
        !block[2]!.includes('// @error:') &&
        !block[2]!.includes("from 'zyzz/default'"),
    )

    const css = sources.map((block, index) => {
      const extracted = Source.extract({
        moduleId: `Example${index}.tsx`,
        source: displayed(block[2]!),
      })
      return Css.compile({ styles: extracted.styles }).css
    })

    expect(sources).toHaveLength(5)
    expect(css.every((output) => output.length > 0)).toBe(true)
    expect(css[0]).toContain('left:0px;')
    expect(css[1]).toContain('color:red!important;')
    expect(css[1]).toContain('display:block;display:flex;')
    expect(css[4]).toContain('margin-inline-start:16px;')
    expect(css[4]).toContain('padding-inline-end:8px;')
    expect(css[4]).toContain('left:0px;')
  })

  test('type-checks examples and loads authored configs', () => {
    const fixture = Path.join(directory, 'consumer')
    Fs.mkdirSync(Path.join(fixture, 'node_modules'), { recursive: true })
    Fs.symlinkSync(root, Path.join(fixture, 'node_modules/zyzz'), 'dir')
    Fs.writeFileSync(Path.join(fixture, 'package.json'), '{"type":"module"}')
    const configs = blocks.filter((block) => block[1] === 'json')
    const card = blocks
      .find((block) => block[2]!.includes('cx(styles.label()'))![2]!
      .replace("padding: '16px'", "padding: '4px'")
    for (const name of ['@types', 'react', 'vite-plus'])
      Fs.symlinkSync(
        Path.join(root, 'node_modules', name),
        Path.join(fixture, 'node_modules', name),
        'dir',
      )
    const examples = blocks.filter(
      (block) =>
        ['ts', 'tsx'].includes(block[1]!) &&
        !block[2]!.includes('// @noErrors'),
    )
    const files = examples.map((block, index) => {
      const file = Path.join(fixture, `Example${index}.tsx`)
      Fs.writeFileSync(file, displayed(block[2]!))
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
      Fs.writeFileSync(Path.join(fixture, 'source.tsx'), card)

      const result = ChildProcess.spawnSync(
        process.execPath,
        [binary, '-c', '.oxlintrc.json', '--format', 'json', 'source.tsx'],
        { cwd: fixture, encoding: 'utf8', timeout: 30000 },
      )

      expect(result.status, result.stderr).toBe(0)
      expect(JSON.parse(result.stdout).diagnostics).toEqual([])
    }

    Fs.writeFileSync(Path.join(fixture, 'vite.config.ts'), examples[0]![2]!)
    Fs.writeFileSync(Path.join(fixture, 'source.tsx'), card)

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
  }, 60000)

  test('documents every rule with the diagnostics Oxlint reports', () => {
    const fixture = Path.join(directory, 'rules')
    Fs.mkdirSync(Path.join(fixture, 'node_modules'), { recursive: true })
    Fs.symlinkSync(root, Path.join(fixture, 'node_modules/zyzz'), 'dir')
    Fs.writeFileSync(Path.join(fixture, 'package.json'), '{"type":"module"}')
    for (const name of ['@types', 'react'])
      Fs.symlinkSync(
        Path.join(root, 'node_modules', name),
        Path.join(fixture, 'node_modules', name),
        'dir',
      )
    const binary = Path.join(
      Path.dirname(require.resolve('oxlint/package.json')),
      'bin/oxlint',
    )

    function lint(code: string) {
      Fs.writeFileSync(Path.join(fixture, 'source.tsx'), source(code))
      const result = ChildProcess.spawnSync(
        process.execPath,
        [binary, '-c', '.oxlintrc.json', '--format', 'json', 'source.tsx'],
        { cwd: fixture, encoding: 'utf8', timeout: 30000 },
      )
      expect(result.stderr).toBe('')
      return JSON.parse(result.stdout).diagnostics.map(
        (diagnostic: {
          code: string
          labels: { span: { line: number } }[]
          message: string
        }) =>
          `${diagnostic.labels[0]!.span.line}: ${diagnostic.code}: ${diagnostic.message}`,
      )
    }

    expect(rules.map((rule) => rule.id).sort()).toEqual(
      Object.keys(plugin.rules).sort(),
    )

    for (const rule of rules) {
      // Each annotation follows the source line its diagnostic reports.
      const expected: string[] = []
      let line = 0
      for (const text of rule.incorrect.split('\n')) {
        const annotation = text.match(/^\s*\/\/ @error: (.+)$/)
        if (annotation) expected.push(`${line}: ${annotation[1]}`)
        else if (!/^\s*\/\/ @noErrors/.test(text)) line++
      }
      Fs.writeFileSync(
        Path.join(fixture, '.oxlintrc.json'),
        JSON.stringify({
          categories: { correctness: 'off' },
          jsPlugins: [{ name: 'zyzz', specifier: 'zyzz/oxlint' }],
          rules: rule.options
            ? JSON.parse(rule.options).rules
            : { [`zyzz/${rule.id}`]: 'error' },
        }),
      )

      expect(expected.length, rule.id).toBeGreaterThan(0)
      expect(lint(rule.incorrect), rule.id).toEqual(expected)
      expect(lint(displayed(rule.correct)), rule.id).toEqual([])
    }
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
      const fences = Array.from(
        markdown.matchAll(/```\w*[^\n]*\n([\s\S]*?)```/g),
        (match) => match[1]!,
      )
      const annotation = /^\s*\/\/ (zyzz\([\w-]+\): .+)$/
      const code = fences.map((fence) =>
        fence
          .split('\n')
          .filter((line) => !annotation.test(line))
          .join('\n')
          .trim(),
      )
      const annotations = blocks.flatMap((block) =>
        Array.from(
          block[2]!.matchAll(/\/\/ @error: (.+)/g),
          (match) => match[1],
        ),
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
            .replace(/^[*-] /gm, '')
            .replace(/\*\*/g, '')
            .replace(/\\?\[!NOTE\]/g, '')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/`/g, '')
            .replace(/\s+/g, ' ')
            .trim(),
        )
        .filter(Boolean)

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/markdown')
      expect(await page.title()).toBe('Linting · Guides · Zyzz')
      expect(await article.locator('h1, h2, h3').allTextContents()).toEqual(
        headings,
      )
      expect(
        await article.locator('pre code').evaluateAll((nodes) =>
          nodes.map((node) => {
            const clone = node.cloneNode(true) as Element
            // Twoslash renders each annotation row in place of a line break.
            for (const row of clone.querySelectorAll('.twoslash-tag-line'))
              row.replaceWith('\n')
            return clone.textContent!.trim()
          }),
        ),
      ).toEqual(code)
      expect(code).toEqual(blocks.map((block) => displayed(block[2]!)))
      expect(
        await article.locator('.twoslash-tag-line').allTextContents(),
      ).toEqual(annotations)
      expect(
        fences.flatMap((fence) =>
          fence
            .split('\n')
            .flatMap((line) => line.match(annotation)?.[1] ?? []),
        ),
      ).toEqual(annotations)
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
            .getByRole('radio', {
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
