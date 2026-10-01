/** Verifies stylesheet guide examples and their published documentation. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs'
import * as Os from 'node:os'
import * as Path from 'node:path'
import { compile } from '@mdx-js/mdx'
import type { Nodes, Root } from 'mdast'
import { chromium } from 'playwright'
import * as Ts from 'typescript-api'
import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'

const origin = 'http://localhost:3184'
const route = '/docs/guides/stylesheets'
const site = new URL('../../../..', import.meta.url)
const root = Fs.realpathSync(new URL('..', site))
const source = Fs.readFileSync(
  new URL('./stylesheets.mdx', import.meta.url),
  'utf8',
)
const examples = [
  ...source.matchAll(/```(?:ts|tsx) title="([^"]+)"\n([\s\S]*?)\n```/g),
]
let directory: string
let server: ChildProcess.ChildProcess

function text(node: Nodes): string {
  if ('children' in node) return node.children.map(text).join('')
  if ('value' in node) return node.value
  return ''
}

describe('Stylesheets', () => {
  test('type checks and compiles every authored example', () => {
    const fixture = Fs.mkdtempSync(Path.join(root, '.fixture-stylesheets-'))
    const modules: Record<string, string> = {}
    try {
      for (const example of examples) {
        const path = example[1]!
        modules[path] = example[2]!
        Fs.mkdirSync(Path.dirname(Path.join(fixture, path)), {
          recursive: true,
        })
        Fs.writeFileSync(Path.join(fixture, path), example[2]!)
      }
      Fs.writeFileSync(Path.join(fixture, 'package.json'), '{"type":"module"}')
      const config = Ts.readConfigFile(
        Path.join(root, 'tsconfig.json'),
        Ts.sys.readFile,
      )
      const parsed = Ts.parseJsonConfigFileContent(config.config, Ts.sys, root)
      const program = Ts.createProgram(
        Object.keys(modules).map((path) => Path.join(fixture, path)),
        {
          ...parsed.options,
          paths: {
            zyzz: [Path.join(root, 'dist/index.d.ts')],
            'zyzz/vite': [Path.join(root, 'dist/vite/index.d.ts')],
            'zyzz/web': [Path.join(root, 'dist/web/index.d.ts')],
          },
          types: ['node', 'vite/client'],
        },
      )
      const diagnostics = Ts.getPreEmitDiagnostics(program)
        .filter((diagnostic) => diagnostic.file?.fileName.startsWith(fixture))
        .map((diagnostic) =>
          Ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        )

      expect(diagnostics).toMatchInlineSnapshot('[]')

      const output = Graph.compile({ modules })

      expect(
        output.sharedCss?.includes('@layer reset,base,components;'),
      ).toMatchInlineSnapshot('true')
      expect(
        output.sharedCss?.includes('@media print{nav{display:none;}}'),
      ).toMatchInlineSnapshot('true')
      expect(output.sharedCss?.includes('@font-face')).toMatchInlineSnapshot(
        'true',
      )
      expect(
        output.sharedCss?.includes(
          '@page{size:A4;margin:2cm;@bottom-center{content:counter(page);}}',
        ),
      ).toMatchInlineSnapshot('true')
      expect(
        output.modules['Notice.tsx']?.css.includes('prefers-reduced-motion'),
      ).toMatchInlineSnapshot('true')
      expect(
        output.modules['src/tooltip.ts']?.css.includes(
          'position-try-fallbacks:',
        ),
      ).toMatchInlineSnapshot('true')
    } finally {
      Fs.rmSync(fixture, { recursive: true, force: true })
    }
  }, 30000)

  describe('published page', () => {
    beforeAll(async () => {
      directory = Fs.realpathSync(
        Fs.mkdtempSync(`${Os.tmpdir()}/zyzz-stylesheets-site-`),
      )
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
          `import { createBuilder, preview } from 'vite'; const builder = await createBuilder({ cacheDir: ${JSON.stringify(`${directory}/.vite`)} }); await builder.buildApp(); await preview({ preview: { port: 3184, strictPort: true } });`,
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
      let state = 'Waiting for the server'
      for (let attempt = 0; attempt < 720; attempt++) {
        if (server.exitCode !== null) throw new Error(output)
        try {
          const response = await fetch(`${origin}${route}`, {
            signal: AbortSignal.timeout(2000),
          })
          if (response.ok) return
          state = `HTTP ${response.status}: ${await response.text()}`
        } catch (error) {
          state = String(error)
        }
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      throw new Error(`Stylesheets page did not start. ${state} ${output}`)
    }, 210000)

    afterAll(async () => {
      if (server?.pid && server.exitCode === null) {
        const exited = new Promise((resolve) => server.once('exit', resolve))
        process.kill(-server.pid, 'SIGTERM')
        await exited
      }
      if (directory) Fs.rmSync(directory, { recursive: true, force: true })
    })

    test('preserves prose, headings, tables, and examples in HTML and Markdown', async () => {
      const response = await fetch(`${origin}${route}.md`)
      const markdown = await response.text()
      const headings: string[] = []
      const paragraphs: string[] = []
      await compile(markdown, {
        remarkPlugins: [
          () => (tree: Root) => {
            for (const node of tree.children) {
              if (node.type === 'heading') headings.push(text(node))
              if (node.type === 'paragraph' && !text(node).startsWith('|'))
                paragraphs.push(text(node))
            }
          },
        ],
      })
      const browser = await chromium.launch({ headless: true })
      try {
        const page = await browser.newPage()
        const html = await page.goto(`${origin}${route}`)
        const article = page.locator('article')

        expect(response.status).toMatchInlineSnapshot('200')
        expect(response.headers.get('content-type')).toMatchInlineSnapshot(
          '"text/markdown; charset=utf-8"',
        )
        expect(html?.status()).toMatchInlineSnapshot('200')
        expect(await page.title()).toMatchInlineSnapshot('"Stylesheets · Zyzz"')
        expect(
          JSON.stringify(
            await article.locator('h1, h2, h3').allTextContents(),
          ) === JSON.stringify(headings),
        ).toMatchInlineSnapshot('true')
        expect(
          JSON.stringify(
            await article.locator('p:not(table p)').allTextContents(),
          ) === JSON.stringify(paragraphs),
        ).toMatchInlineSnapshot('true')
        expect(
          JSON.stringify(
            await article
              .locator('pre code')
              .allTextContents()
              .then((codes) => codes.map((code) => code.trim())),
          ) === JSON.stringify(examples.map((example) => example[2])),
        ).toMatchInlineSnapshot('true')
        expect(await article.locator('table').count()).toMatchInlineSnapshot(
          '2',
        )
        expect(
          markdown.includes('Unlayered → components → base → reset'),
        ).toMatchInlineSnapshot('true')
        expect(
          markdown.includes('reset → base → components → unlayered'),
        ).toMatchInlineSnapshot('true')
        for (const example of examples)
          expect(markdown.includes(example[2]!)).toMatchInlineSnapshot('true')
        expect(
          await page
            .getByRole('navigation', { name: 'Documentation' })
            .getByRole('link', { name: 'Stylesheets', exact: true })
            .getAttribute('aria-current'),
        ).toMatchInlineSnapshot('"page"')
        const negotiated = await fetch(`${origin}${route}`, {
          headers: { accept: 'text/markdown' },
        })
        expect((await negotiated.text()) === markdown).toMatchInlineSnapshot(
          'true',
        )
      } finally {
        await browser.close()
      }
    }, 30000)

    test('fits light and dark layouts at supported viewport widths', async () => {
      const browser = await chromium.launch({ headless: true })
      try {
        for (const colorScheme of ['light', 'dark'] as const) {
          const context = await browser.newContext({ colorScheme })
          const page = await context.newPage()
          await page.goto(`${origin}${route}`)
          await page.waitForLoadState('networkidle')
          for (const width of [390, 768, 1440]) {
            await page.setViewportSize({ width, height: 1000 })
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toMatchInlineSnapshot('true')
            expect(
              await page
                .locator('article')
                .evaluate(
                  (article) =>
                    article.getBoundingClientRect().right <= innerWidth,
                ),
            ).toMatchInlineSnapshot('true')
            expect(
              await page.locator('article h1').textContent(),
            ).toMatchInlineSnapshot('"Stylesheets"')
            expect(
              await page.locator('article table').evaluateAll((tables) =>
                tables.every((table) => {
                  const bounds = table.getBoundingClientRect()
                  const cells = Array.from(table.querySelectorAll('th, td'))
                  const bodyCells = Array.from(table.querySelectorAll('td'))

                  return (
                    bounds.left >= 0 &&
                    bounds.right <= innerWidth &&
                    cells.every((cell) => {
                      const style = getComputedStyle(cell)
                      return (
                        parseFloat(style.paddingLeft) > 0 &&
                        parseFloat(style.paddingTop) > 0
                      )
                    }) &&
                    bodyCells.every(
                      (cell) =>
                        parseFloat(getComputedStyle(cell).borderTopWidth) > 0,
                    ) &&
                    Array.from(table.querySelectorAll('p')).every(
                      (paragraph) =>
                        getComputedStyle(paragraph).margin === '0px',
                    )
                  )
                }),
              ),
            ).toMatchInlineSnapshot('true')
          }
          await context.close()
        }
      } finally {
        await browser.close()
      }
    }, 30000)
  })
})
