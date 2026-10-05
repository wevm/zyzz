/** Verifies native guide examples, Markdown, and responsive rendering. @module */
import * as Babel from '@babel/core'
import { compile } from '@mdx-js/mdx'
import type { Nodes, Root } from 'mdast'
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs'
import * as Os from 'node:os'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test'
import { zyzz } from 'zyzz/babel'

const origin = 'http://localhost:33341'
let server: ChildProcess.ChildProcess
let output = ''
const directory = Fs.realpathSync(
  Fs.mkdtempSync(`${Os.tmpdir()}/zyzz-docs-test-`),
)
const site = new URL('../../../..', import.meta.url)

test('compiles every Zyzz example in the native guides for iOS and Android', () => {
  const pages = [
    new URL('native.mdx', import.meta.url),
    ...Fs.readdirSync(new URL('native/', import.meta.url))
      .filter((file) => file.endsWith('.mdx'))
      .map((file) => new URL(`native/${file}`, import.meta.url)),
  ]
  let compiled = 0

  for (const page of pages) {
    const authored = Fs.readFileSync(page, 'utf8')
    let config: string | undefined

    for (const [index, match] of [
      ...authored.matchAll(/```tsx?(?: title="([^"]+)")?\n([\s\S]*?)```/g),
    ].entries()) {
      const source = match[2]!
      if (match[1] === 'zyzz.config.ts') config = source
      // Migration examples, Metro configs, and manual tables are not compiled by the Babel plugin.
      if (
        source.includes('react-native-unistyles') ||
        source.includes("from 'expo/metro-config'") ||
        source.includes('StyleSheet.compile')
      )
        continue
      if (!/from '(zyzz|\.\/zyzz\.config\.js)/.test(source)) continue

      const moduleId = 'Example' + index + '.tsx'
      const modules: Record<string, string> = { [moduleId]: source }
      if (source.includes("from './zyzz.config.js'"))
        modules['zyzz.config.ts'] = config!
      for (const platform of ['ios', 'android'] as const) {
        const result = Babel.transformSync(source, {
          configFile: false,
          filename: moduleId,
          parserOpts: { plugins: ['typescript', 'jsx'] },
          plugins: [
            [
              zyzz,
              {
                moduleId,
                modules,
                platform,
                target: 'native',
                units: { px: 1, rem: 16 },
              },
            ],
          ],
        })

        if (source.includes('styles.'))
          expect(result?.code).toContain('zyzz/runtime')
      }
      compiled++
    }
  }

  expect(compiled).toMatchInlineSnapshot('45')
})

describe('/docs/guides/native', () => {
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
    server = ChildProcess.spawn(
      'node',
      [
        '--input-type=module',
        '-e',
        `import { createServer } from 'vite'; const server = await createServer({ cacheDir: ${JSON.stringify(`${directory}/.vite`)}, server: { port: 33341, strictPort: true, fs: { allow: ${JSON.stringify([directory, Fs.realpathSync(new URL('../../../../..', import.meta.url)), Fs.realpathSync(new URL('node_modules/zyzz', site))])} } } }); await server.listen();`,
      ],
      {
        cwd: directory,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    server.stdout?.on('data', (data) => {
      output += data
    })
    server.stderr?.on('data', (data) => {
      output += data
    })
    for (let attempt = 0; attempt < 600; attempt++) {
      if (server.exitCode !== null) throw new Error(output)
      try {
        if (
          (
            await fetch(`${origin}/docs/guides/native`, {
              headers: { Accept: 'text/markdown' },
              signal: AbortSignal.timeout(3000),
            })
          ).ok
        )
          return
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error(`Documentation site did not start. ${output}`)
  }, 180000)

  afterAll(async () => {
    if (server?.pid && server.exitCode === null) {
      const exited = new Promise((resolve) => server.once('exit', resolve))
      process.kill(-server.pid, 'SIGTERM')
      await exited
    }
    Fs.rmSync(directory, { recursive: true, force: true })
  })

  test('keeps authored content and code in both Markdown endpoints and HTML', async () => {
    const extension = await fetch(`${origin}/docs/guides/native.md`)
    const negotiated = await fetch(`${origin}/docs/guides/native`, {
      headers: { Accept: 'text/markdown' },
    })
    const html = await fetch(`${origin}/docs/guides/native`, {
      headers: { Accept: 'text/html' },
    })

    expect(extension.status).toBe(200)
    expect(negotiated.status).toBe(200)
    expect(html.status, output).toBe(200)
    const markdown = await extension.text()
    expect(await negotiated.text()).toBe(markdown)
    expect(markdown).toContain('npm install zyzz')
    expect(markdown).toContain(
      'Rebuild a development client after installing Zyzz.',
    )
    expect(markdown).toContain(
      "[Expo's Metro guide](https://docs.expo.dev/guides/customizing-metro/)",
    )

    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.goto(`${origin}/docs/guides/native`)
      const article = page.locator('article')
      const authored = Fs.readFileSync(
        new URL('native.mdx', import.meta.url),
        'utf8',
      )
      const visible = (await article.innerText()).replace(/\s+/g, ' ')
      function content(node: Nodes): string {
        if ('children' in node) return node.children.map(content).join('')
        if ('value' in node) return node.value
        return ''
      }
      await compile(authored, {
        remarkPlugins: [
          () => (tree: Root) => {
            function visit(node: Nodes) {
              if (node.type === 'paragraph')
                expect(visible).toContain(content(node).replace(/\s+/g, ' '))
              if ('children' in node)
                for (const child of node.children) visit(child)
            }
            visit(tree)
          },
        ],
      })
      for (const match of authored.matchAll(/^##?#? (.+)$/gm)) {
        expect(markdown).toContain(match[0])
        expect(
          await article
            .getByRole('heading', { name: match[1]!, exact: true })
            .count(),
        ).toBe(1)
      }
      const snippets = [
        ...authored.matchAll(/```(?:ts|tsx)[^\n]*\n([\s\S]*?)```/g),
      ]
      const blocks = await article.locator('pre code').allTextContents()
      const visibleBlocks = blocks.map((block) => block.trim())
      for (const match of snippets) {
        expect(markdown).toContain(match[1]!.trim())
        expect(visibleBlocks).toContain(match[1]!.trim())
      }
    } finally {
      await browser.close()
    }
  }, 60000)

  test('renders without page overflow at supported sizes and appearances', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme })
        for (const width of [390, 768, 1440]) {
          await page.setViewportSize({ width, height: 1000 })
          await page.goto(`${origin}/docs/guides/native`)
          await page.waitForFunction(() => {
            const heading = document.querySelector('article h1')
            return heading && getComputedStyle(heading).fontSize === '32px'
          })
          await page.waitForFunction(() => document.fonts.status === 'loaded')
          expect(await page.locator('article').isVisible()).toBe(true)
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
          ).toBe(false)
          expect(
            await page
              .locator('article pre')
              .evaluateAll((blocks) =>
                blocks.every(
                  (block) => block.getBoundingClientRect().right <= innerWidth,
                ),
              ),
          ).toBe(true)
        }
      }
    } finally {
      await browser.close()
    }
  }, 60000)
})
