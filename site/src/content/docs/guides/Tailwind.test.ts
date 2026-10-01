/** Verifies the migration guide's source examples and published content. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Os from 'node:os'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import * as Ts from 'typescript-api'
import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'

const root = Path.resolve(import.meta.dirname, '../../../../..')
const guide = await Fs.readFile(
  new URL('./tailwind.mdx', import.meta.url),
  'utf8',
)
const examples = [
  ...guide.matchAll(/```(tsx|ts)(?: title="([^"]+)")?\n([\s\S]*?)```/g),
]
const config = examples.find((entry) => entry[2] === 'zyzz.config.ts')![3]!
const origin = 'http://localhost:34159'
const route = '/docs/guides/tailwind'
let server: ChildProcess.ChildProcess
let directory: string

describe('Tailwind migration examples', () => {
  test('type-checks every TypeScript example against public source contracts', async () => {
    const directory = await Fs.mkdtemp(Path.join(root, '.fixture-tailwind-'))
    const files: string[] = []
    try {
      for (const [index, entry] of examples.entries()) {
        const folder = Path.join(directory, String(index))
        await Fs.mkdir(folder)
        const path = Path.join(folder, `example.${entry[1]}`)
        await Fs.writeFile(path, entry[3]!)
        await Fs.writeFile(Path.join(folder, 'zyzz.config.ts'), config)
        files.push(path)
      }
      const settings = Ts.readConfigFile(
        Path.join(root, 'tsconfig.json'),
        Ts.sys.readFile,
      )
      const parsed = Ts.parseJsonConfigFileContent(
        settings.config,
        Ts.sys,
        root,
      )
      const program = Ts.createProgram(files, {
        ...parsed.options,
        types: ['node', 'vite/client'],
      })
      const diagnostics = [
        ...program.getOptionsDiagnostics(),
        ...files.flatMap((file) => {
          const source = program.getSourceFile(file)!
          return [
            ...program.getSyntacticDiagnostics(source),
            ...program.getSemanticDiagnostics(source),
          ]
        }),
      ]

      expect(
        Ts.formatDiagnosticsWithColorAndContext(diagnostics, {
          getCanonicalFileName: (file) => file,
          getCurrentDirectory: () => root,
          getNewLine: () => '\n',
        }),
      ).toMatchInlineSnapshot('""')
    } finally {
      await Fs.rm(directory, { recursive: true, force: true })
    }
  }, 120000)

  test('compiles all authored definitions, including config imports and relationships', () => {
    const results = examples
      .filter(
        (entry) =>
          entry[3]!.includes('style(') ||
          entry[3]!.includes('variants(') ||
          entry[3]!.includes('global('),
      )
      .map((entry, index) => {
        const output = Graph.compile({
          modules: {
            [`example-${index}.${entry[1]}`]: entry[3]!,
            'zyzz.config.ts': config,
          },
        })
        return Object.values(output.modules)
          .map((module) => module.css)
          .join('\n')
      })

    expect(results.length).toMatchInlineSnapshot('13')
    expect(results.every((css) => css.length > 0)).toMatchInlineSnapshot('true')
    expect(results.join('\n').includes('padding:1.5rem')).toMatchInlineSnapshot(
      'true',
    )
    expect(
      results.join('\n').includes('@media (hover: hover)'),
    ).toMatchInlineSnapshot('true')
    expect(results.join('\n').includes(':invalid ~')).toMatchInlineSnapshot(
      'true',
    )
    expect(
      results.join('\n').includes('@container sidebar'),
    ).toMatchInlineSnapshot('true')
    const paired = examples.find(
      (entry) => entry[2] === 'appearance.config.ts',
    )![3]!
    const output = Graph.compile({
      modules: {
        'appearance.config.ts': paired,
        'panel.ts':
          "import {style} from './appearance.config.js'; export const panel = style({color:'foreground',backgroundColor:'surface'});",
      },
    })
    expect(
      [
        output.sharedCss,
        ...Object.values(output.modules).map((module) => module.css),
      ]
        .join('\n')
        .includes('light-dark('),
    ).toMatchInlineSnapshot('true')
  })
})

describe('Tailwind migration page', () => {
  beforeAll(async () => {
    directory = await Fs.realpath(
      await Fs.mkdtemp(Path.join(Os.tmpdir(), 'zyzz-tailwind-page-')),
    )
    await Fs.cp(Path.join(root, 'site/src'), Path.join(directory, 'src'), {
      recursive: true,
    })
    for (const file of [
      'package.json',
      'tsconfig.json',
      'tsr.config.json',
      'wrangler.jsonc',
    ])
      await Fs.copyFile(
        Path.join(root, 'site', file),
        Path.join(directory, file),
      )
    const config = await Fs.readFile(
      Path.join(root, 'site/vite.config.ts'),
      'utf8',
    )
    await Fs.writeFile(
      Path.join(directory, 'vite.config.ts'),
      config.replace('cloudflare({', 'cloudflare({ inspectorPort: false,'),
    )
    await Fs.symlink(
      Path.join(root, 'site/node_modules'),
      Path.join(directory, 'node_modules'),
      'dir',
    )
    server = ChildProcess.spawn(
      'node',
      [
        '--input-type=module',
        '-e',
        `import {createServer} from 'vite'; const server = await createServer({cacheDir: ${JSON.stringify(Path.join(directory, '.vite'))}, server: {port: 34159, strictPort: true, fs: {allow: ${JSON.stringify([directory, root])}}}}); await server.listen();`,
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
        if ((await fetch(`${origin}${route}`)).ok) return
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error(`Tailwind page did not start. ${output}`)
  }, 180000)

  afterAll(async () => {
    if (server?.pid && server.exitCode === null) {
      const exited = new Promise((resolve) => server.once('exit', resolve))
      process.kill(-server.pid, 'SIGTERM')
      await exited
    }
    if (directory) await Fs.rm(directory, { recursive: true, force: true })
  })

  test('preserves all headings, code, and table cells in HTML and Markdown', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      const response = await page.goto(`${origin}${route}`)
      await page.waitForLoadState('networkidle')
      const markdownResponse = await fetch(`${origin}${route}.md`)
      const markdown = await markdownResponse.text()

      expect(response?.status()).toMatchInlineSnapshot('200')
      expect(markdownResponse.status).toMatchInlineSnapshot('200')
      expect(
        markdownResponse.headers.get('content-type'),
      ).toMatchInlineSnapshot('"text/markdown; charset=utf-8"')
      expect(await page.getByRole('heading', { level: 1 }).allTextContents())
        .toMatchInlineSnapshot(`
        [
          "Migrating from Tailwind",
        ]
      `)
      expect(await page.title()).toMatchInlineSnapshot(
        '"Migrating from Tailwind · Zyzz"',
      )
      const headings = await page
        .locator('main article h2, main article h3')
        .allTextContents()
      expect(
        headings.filter((heading) => !markdown.includes(heading)),
      ).toMatchInlineSnapshot('[]')
      const code = await page.locator('main article pre code').allTextContents()
      expect(
        code.filter((value) => !markdown.includes(value.trim())),
      ).toMatchInlineSnapshot('[]')
      const cells = await page
        .locator('main article table th, main article table td')
        .allTextContents()
      const plain = markdown
        .replace(/<br\s*\/?>/g, ' ')
        .replaceAll('`', '')
        .replace(/\\([\\*_])/g, '$1')
        .replace(/\s+/g, ' ')
      expect(
        cells.filter(
          (cell) => !plain.includes(cell.trim().replace(/\s+/g, ' ')),
        ),
      ).toMatchInlineSnapshot('[]')
      const prose = markdown
        .replace(/<br\s*\/?>/g, ' ')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replaceAll('`', '')
        .replaceAll('**', '')
        .replace(/\s+/g, ' ')
      const paragraphs = await page
        .locator('main article p:not(table p)')
        .allTextContents()
      expect(paragraphs.length > 40).toMatchInlineSnapshot('true')
      expect(
        paragraphs.filter(
          (paragraph) => !prose.includes(paragraph.replace(/\s+/g, ' ').trim()),
        ),
      ).toMatchInlineSnapshot('[]')
      const navigation = page.getByRole('navigation', { name: 'Documentation' })
      expect(
        await navigation
          .getByRole('link', { name: 'Migrating from Tailwind', exact: true })
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
  }, 120000)

  test('fits mobile, tablet, and desktop in light and dark modes', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(`${origin}${route}`)
      await page.waitForLoadState('networkidle')
      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 })
        for (const scheme of ['Light', 'Dark']) {
          if (width < 1024)
            await page
              .getByRole('button', { name: 'Open menu', exact: true })
              .click()
          await page.getByRole('button', { name: scheme, exact: true }).click()
          if (width < 1024) {
            await page
              .getByRole('button', { name: 'Close menu', exact: true })
              .click()
            await page
              .getByRole('dialog', { name: 'Documentation menu' })
              .waitFor({ state: 'hidden' })
          }
          const layout = await page.evaluate(() => ({
            scheme: getComputedStyle(document.documentElement).colorScheme,
            viewport: document.documentElement.clientWidth,
            width: document.documentElement.scrollWidth,
          }))

          expect(layout.scheme === scheme.toLowerCase()).toMatchInlineSnapshot(
            'true',
          )
          expect(layout.width <= layout.viewport).toMatchInlineSnapshot('true')
          expect(
            await page.locator('main table').count(),
          ).toMatchInlineSnapshot('4')
        }
      }
      expect(errors).toMatchInlineSnapshot('[]')
    } finally {
      await browser.close()
    }
  }, 120000)
})
