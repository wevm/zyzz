/** Exercises Compatibility table layout and keyboard navigation in a browser. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs'
import * as Os from 'node:os'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test'

const origin = 'http://localhost:33330'
let server: ChildProcess.ChildProcess
const directory = Fs.realpathSync(
  Fs.mkdtempSync(`${Os.tmpdir()}/zyzz-docs-test-`),
)
const site = new URL('../../../..', import.meta.url)

describe('/docs/introduction/compatibility', () => {
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
    Fs.writeFileSync(
      `${directory}/src/content/docs/introduction/table-fixture.mdx`,
      `# Table fixture

A table serialization fixture.

<table><thead><tr><th>

Value

</th><th>

Description

</th></tr></thead><tbody><tr><th>

\`one | two\`

</th><td>

First paragraph with **bold** text.

Second paragraph with a [link](/docs).

</td></tr></tbody></table>
`,
    )
    server = ChildProcess.spawn(
      'node',
      [
        '--input-type=module',
        '-e',
        `import { createServer } from 'vite'; const server = await createServer({ cacheDir: ${JSON.stringify(`${directory}/.vite`)}, server: { port: 33330, strictPort: true, fs: { allow: ${JSON.stringify([directory, Fs.realpathSync(new URL('../../../../..', import.meta.url))])} } } }); await server.listen();`,
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
    // The first request compiles every documentation page.
    for (let attempt = 0; attempt < 480; attempt++) {
      if (server.exitCode !== null) throw new Error(output)
      try {
        if ((await fetch(`${origin}/docs/introduction/compatibility`)).ok)
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

  test('preserves row associations through both Markdown endpoints', async () => {
    const extension = await fetch(
      `${origin}/docs/introduction/compatibility.md`,
    )
    const negotiated = await fetch(
      `${origin}/docs/introduction/compatibility`,
      {
        headers: { Accept: 'text/markdown' },
      },
    )
    expect(extension.status).toMatchInlineSnapshot('200')
    expect(negotiated.status).toMatchInlineSnapshot('200')
    const markdown = await extension.text()
    expect((await negotiated.text()) === markdown).toMatchInlineSnapshot('true')
    const tables = markdown
      .split('\n\n')
      .filter((block) => block.startsWith('| '))
    expect(tables.map((table) => table.split('\n').length))
      .toMatchInlineSnapshot(`
      [
        8,
        6,
        5,
        6,
      ]
    `)
    expect(tables.map((table) => table.split('\n')[0])).toMatchInlineSnapshot(`
      [
        "| Framework | Support and scope |",
        "| Environment | Support and scope |",
        "| Browser | Minimum target |",
        "| Boundary | Support and scope |",
      ]
    `)
    expect(
      tables.every((table) => table.split('\n')[1] === '| --- | --- |'),
    ).toMatchInlineSnapshot('true')
    expect(
      tables[0]
        ?.split('\n')[2]
        ?.includes(
          '[lazy delivery tests](https://github.com/wevm/zyzz/blob/main/src/vite/index.test.ts)',
        ),
    ).toMatchInlineSnapshot('true')
    expect(
      tables[2]
        ?.split('\n')
        .slice(2)
        .every((row) => row.includes('Native `light-dark()` support.')),
    ).toMatchInlineSnapshot('true')
    expect(markdown.includes('CompatibilityIcon')).toMatchInlineSnapshot(
      'false',
    )
  })

  test('escapes table pipes and retains multiline cell content', async () => {
    const response = await fetch(`${origin}/docs/introduction/table-fixture.md`)
    expect(response.status).toMatchInlineSnapshot('200')
    const markdown = await response.text()
    expect(markdown.slice(markdown.indexOf('| '))).toMatchInlineSnapshot(`
      "| Value | Description |
      | --- | --- |
      | \`one \\| two\` | First paragraph with **bold** text.<br />Second paragraph with a [link](/docs). |
      "
    `)
  })

  test('preserves responsive tables without inert keyboard stops', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 1000 })
        await page.goto(`${origin}/docs/introduction/compatibility`, {
          timeout: 60000,
          waitUntil: 'networkidle',
        })
        await page.waitForFunction(() => {
          const table = document.querySelector('article table')
          return (
            table && getComputedStyle(table.parentElement!).fontSize === '14px'
          )
        })
        expect(
          await page.locator('article table').count(),
        ).toMatchInlineSnapshot('4')
        expect(
          await page.locator('article [role="region"][tabindex]').count(),
        ).toMatchInlineSnapshot('0')
        expect(
          await page.locator('article table caption').count(),
        ).toMatchInlineSnapshot('0')
        expect(
          await page.locator('article [data-unverified] svg').count(),
        ).toMatchInlineSnapshot('2')
        expect(
          await page.locator('article [data-target] svg').count(),
        ).toMatchInlineSnapshot('3')
        expect(
          await page
            .locator('article table')
            .first()
            .evaluate((table) => getComputedStyle(table).tableLayout),
        ).toMatchInlineSnapshot('"fixed"')
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
        ).toMatchInlineSnapshot('false')
        expect(
          await page
            .locator('article p code')
            .evaluateAll((codes) =>
              codes.every(
                (code) =>
                  parseFloat(getComputedStyle(code).fontSize) <
                  parseFloat(getComputedStyle(code.parentElement!).fontSize),
              ),
            ),
        ).toMatchInlineSnapshot('true')
        expect(
          await page
            .getByRole('link', { name: 'lazy delivery tests' })
            .getAttribute('href'),
        ).toMatchInlineSnapshot(
          '"https://github.com/wevm/zyzz/blob/main/src/vite/index.test.ts"',
        )
      }
    } finally {
      await browser.close()
    }
  }, 120000)
})
