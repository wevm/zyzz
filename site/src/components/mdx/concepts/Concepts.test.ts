/** Verifies concepts Markdown and copy completion after tab changes. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs'
import * as Os from 'node:os'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test'

const origin = 'http://localhost:3138'
let server: ChildProcess.ChildProcess
const directory = Fs.realpathSync(
  Fs.mkdtempSync(`${Os.tmpdir()}/zyzz-concepts-test-`),
)
const site = new URL('../../../..', import.meta.url)

describe('/docs/concepts', () => {
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
        `import { createServer } from 'vite'; const server = await createServer({ cacheDir: ${JSON.stringify(`${directory}/.vite`)}, server: { port: 3138, strictPort: true, fs: { allow: ${JSON.stringify([directory, Fs.realpathSync(new URL('../../../../..', import.meta.url))])} } } }); await server.listen();`,
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
    const deadline = Date.now() + 50_000
    while (Date.now() < deadline) {
      if (server.exitCode !== null) throw new Error(output)
      try {
        if (
          (
            await fetch(`${origin}/docs/concepts?mode=default`, {
              signal: AbortSignal.timeout(2000),
            })
          ).ok
        )
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

  test('preserves capability notes and boundary labels in Markdown', async () => {
    for (const path of ['/docs/concepts.md', '/docs/concepts?mode=default']) {
      const response = await fetch(`${origin}${path}`, {
        headers: { accept: 'text/markdown' },
      })
      expect(response.status).toBe(200)
      const markdown = await response.text()
      expect(markdown.match(/^> \[!NOTE\]$/gm)).toHaveLength(2)
      expect(markdown).toContain(
        '> Finite local scalar callback types are supported.',
      )
      expect(markdown).toContain(
        '> Shared authoring does not imply identical platform capabilities.',
      )
      expect(markdown).toContain(
        '**Core:** Pure data, types, validation, and identity.',
      )
      expect(markdown).toContain(
        '**Source adapters:** Parse and rewrite modules.',
      )
      expect(markdown).toContain(
        '**Target emitters:** Produce CSS or native style tables.',
      )
      expect(markdown).toContain(
        '**Hosts:** Manage files, source discovery, watching, and delivery.',
      )
    }
  })

  test.each(['complete-copy', 'fail-copy'])(
    'ignores stale %s after changing source tabs',
    async (event) => {
      const browser = await chromium.launch({ headless: true })
      try {
        const page = await browser.newPage({
          viewport: { width: 1440, height: 900 },
        })
        await page.goto(`${origin}/docs/concepts?mode=default`, {
          timeout: 60000,
          waitUntil: 'networkidle',
        })
        await page.evaluate(() => {
          Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
              writeText: () =>
                new Promise<void>((resolve, reject) => {
                  window.addEventListener('complete-copy', () => resolve(), {
                    once: true,
                  })
                  window.addEventListener(
                    'fail-copy',
                    () => reject(new Error('Copy failed')),
                    { once: true },
                  )
                }),
            },
          })
        })
        const group = page.locator('[data-concept-tabs]').filter({
          has: page.getByRole('tablist', {
            name: 'Variable scopes',
            exact: true,
          }),
        })
        await group
          .getByRole('button', { name: 'Copy Preview.tsx', exact: true })
          .click()
        await group
          .getByRole('tab', { name: 'zyzz.config.ts', exact: true })
          .click()
        await page.evaluate(
          (event) => window.dispatchEvent(new Event(event)),
          event,
        )
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        )
        expect(
          await group
            .getByRole('button', { name: 'Copy zyzz.config.ts', exact: true })
            .count(),
        ).toBe(1)
        expect(await group.getByRole('alert').count()).toBe(0)
        expect(
          await group
            .getByRole('button', { name: 'Copied zyzz.config.ts', exact: true })
            .count(),
        ).toBe(0)
      } finally {
        await browser.close()
      }
    },
    90000,
  )
})
