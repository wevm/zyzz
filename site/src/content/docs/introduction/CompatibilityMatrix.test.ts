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
    for (let attempt = 0; attempt < 120; attempt++) {
      if (server.exitCode !== null) throw new Error(output)
      try {
        if ((await fetch(`${origin}/docs/introduction/compatibility`)).ok)
          return
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error(`Documentation site did not start. ${output}`)
  }, 60000)

  afterAll(async () => {
    if (server?.pid && server.exitCode === null) {
      const exited = new Promise((resolve) => server.once('exit', resolve))
      process.kill(-server.pid, 'SIGTERM')
      await exited
    }
    Fs.rmSync(directory, { recursive: true, force: true })
  })

  test('preserves responsive tables without inert keyboard stops', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 1000 })
        await page.goto(`${origin}/docs/introduction/compatibility`)
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
  }, 60000)
})
