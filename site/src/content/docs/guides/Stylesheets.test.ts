/** Verifies the stylesheet guides' examples and their published documentation. @module */
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
const site = new URL('../../../..', import.meta.url)
const root = Fs.realpathSync(new URL('..', site))
const guides = [
  { path: 'global-styles', tables: 0, title: 'Global Styles' },
  { path: 'layers', tables: 1, title: 'Layers' },
  { path: 'typography', tables: 0, title: 'Fonts & Typography' },
  { path: 'keyframes', tables: 0, title: 'Keyframes' },
  { path: 'at-rules', tables: 0, title: 'At-Rules' },
  { path: 'reset', tables: 0, title: 'Reset' },
].map((guide) => {
  const source = Fs.readFileSync(
    new URL(`./${guide.path}.mdx`, import.meta.url),
    'utf8',
  )

  return {
    ...guide,
    // Card titles render inside links, while the Markdown route gives each its own paragraph.
    cards: Array.from(
      source.matchAll(/<Card\s+title="([^"]+)"/g),
      (match) => match[1]!,
    ),
    examples: [
      ...source.matchAll(/```(?:ts|tsx) title="([^"]+)"\n([\s\S]*?)\n```/g),
    ],
    fences: Array.from(
      source.matchAll(/```[^\n]*\n([\s\S]*?)\n```/g),
      (match) => match[1]!,
    ),
    route: `/docs/guides/${guide.path}`,
  }
})
const examples = guides.flatMap((guide) => guide.examples)
let directory: string
let server: ChildProcess.ChildProcess

function text(node: Nodes): string {
  if ('children' in node) return node.children.map(text).join('')
  if ('value' in node) return node.value
  return ''
}

describe('stylesheet guides', () => {
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
            'zyzz/default': [Path.join(root, 'dist/default.d.ts')],
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

      expect(Object.keys(modules)).toHaveLength(examples.length)

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
        output.sharedCss?.includes('@view-transition{navigation:auto;}'),
      ).toMatchInlineSnapshot('true')
      expect(
        output.modules['Notice.tsx']?.css.includes('prefers-reduced-motion'),
      ).toMatchInlineSnapshot('true')
      expect(
        output.modules['src/tooltip.ts']?.css.includes(
          'position-try-fallbacks:',
        ),
      ).toMatchInlineSnapshot('true')

      // Each documented helper's example emits its at-rule.
      const css = [
        output.sharedCss ?? '',
        ...Object.values(output.modules).map((module) => module.css),
      ].join('\n')
      expect(
        [
          '@color-profile',
          '@counter-style',
          '@custom-media',
          '@font-face',
          '@font-feature-values',
          '@font-palette-values',
          '@function',
          '@import',
          '@keyframes',
          '@namespace',
          '@page',
          '@position-try',
          '@property',
          '@view-transition',
        ].filter((rule) => !css.includes(rule)),
      ).toMatchInlineSnapshot('[]')
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
          const response = await fetch(`${origin}${guides[0]!.route}`, {
            signal: AbortSignal.timeout(2000),
          })
          if (response.ok) return
          state = `HTTP ${response.status}: ${await response.text()}`
        } catch (error) {
          state = String(error)
        }
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      throw new Error(`Stylesheet guides did not start. ${state} ${output}`)
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
      const browser = await chromium.launch({ headless: true })
      try {
        const page = await browser.newPage()
        for (const guide of guides) {
          const response = await fetch(`${origin}${guide.route}.md`)
          const markdown = await response.text()
          const headings: string[] = []
          const paragraphs: string[] = []
          await compile(markdown, {
            remarkPlugins: [
              () => (tree: Root) => {
                for (const node of tree.children) {
                  if (node.type === 'heading') headings.push(text(node))
                  if (
                    node.type === 'paragraph' &&
                    !text(node).startsWith('|') &&
                    !guide.cards.includes(text(node))
                  )
                    paragraphs.push(text(node))
                }
              },
            ],
          })
          const html = await page.goto(`${origin}${guide.route}`)
          const article = page.locator('article')

          expect(response.status, guide.path).toBe(200)
          expect(response.headers.get('content-type'), guide.path).toBe(
            'text/markdown; charset=utf-8',
          )
          expect(html?.status(), guide.path).toBe(200)
          expect(await page.title()).toBe(`${guide.title} · Guides · Zyzz`)
          expect(
            await article.locator('h1, h2, h3').allTextContents(),
            guide.path,
          ).toEqual(headings)
          expect(
            await article.locator('p:not(table p)').allTextContents(),
            guide.path,
          ).toEqual(paragraphs)
          expect(
            await article
              .locator('pre code')
              .allTextContents()
              .then((codes) => codes.map((code) => code.trim())),
            guide.path,
          ).toEqual(guide.fences)
          expect(await article.locator('table').count(), guide.path).toBe(
            guide.tables,
          )
          for (const example of guide.examples)
            expect(markdown.includes(example[2]!), example[1]).toBe(true)
          expect(
            await page
              .getByRole('navigation', { name: 'Documentation' })
              .getByRole('link', { name: guide.title, exact: true })
              .getAttribute('aria-current'),
            guide.path,
          ).toBe('page')
          const negotiated = await fetch(`${origin}${guide.route}`, {
            headers: { accept: 'text/markdown' },
          })
          expect(await negotiated.text(), guide.path).toBe(markdown)
        }

        const layers = await (
          await fetch(`${origin}/docs/guides/layers.md`)
        ).text()

        expect(
          layers.includes('Unlayered → components → base → reset'),
        ).toMatchInlineSnapshot('true')
        expect(
          layers.includes('reset → base → components → unlayered'),
        ).toMatchInlineSnapshot('true')
      } finally {
        await browser.close()
      }
    }, 60000)

    test('fits light and dark layouts at supported viewport widths', async () => {
      const browser = await chromium.launch({ headless: true })
      try {
        for (const colorScheme of ['light', 'dark'] as const) {
          const context = await browser.newContext({ colorScheme })
          const page = await context.newPage()
          for (const guide of guides) {
            await page.goto(`${origin}${guide.route}`)
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
              expect(await page.locator('article h1').textContent()).toBe(
                guide.title,
              )
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
          }
          await context.close()
        }
      } finally {
        await browser.close()
      }
    }, 120000)
  })
})
