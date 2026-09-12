/**
 * Exercises the Next.js integration through real builds, servers, and Chromium for each bundler.
 * @module
 */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Util from 'node:util'
import { chromium } from 'playwright'
import { beforeAll, describe, expect, test } from 'vite-plus/test'
import * as Fixture from '../../test/fixtures/Next.js'

const exec = Util.promisify(ChildProcess.execFile)

function color(page: Page, selector: string) {
  return page
    .locator(selector)
    .evaluate((element) => getComputedStyle(element).color)
}

function style(page: Page, selector: string, property: string) {
  return page
    .locator(selector)
    .evaluate(
      (element, name) => getComputedStyle(element).getPropertyValue(name),
      property,
    )
}

async function edit(root: string, name: string, from: string, to: string) {
  const file = Path.join(root, name)
  const source = await Fs.readFile(file, 'utf8')

  if (!source.includes(from))
    throw new Error(`${name} does not contain ${from}`)

  await Fs.writeFile(file, source.replace(from, to))
}

type Page = Awaited<
  ReturnType<Awaited<ReturnType<typeof chromium.launch>>['newPage']>
>

describe('zyzz', () => {
  // The fixture consumes the published package layout through a linked node_modules entry.
  beforeAll(async () => {
    await exec('pnpm', ['build'], { timeout: 180000 })
  }, 200000)

  for (const bundler of ['webpack', 'turbopack'] as const) {
    test(`${bundler} builds, serves, hydrates, streams, navigates, refreshes, and recovers`, async () => {
      const root = await Fixture.create(
        await Fs.mkdtemp(Path.resolve(`.fixture-next-${bundler}-`)),
      )
      const browser = await chromium.launch({ headless: true })
      let server: ReturnType<typeof Fixture.start> | undefined

      try {
        const checked = await exec(
          process.execPath,
          [
            Path.join(root, 'node_modules/typescript/bin/tsc'),
            '--noEmit',
            '--strict',
            '--jsx',
            'react-jsx',
            '--module',
            'esnext',
            '--moduleResolution',
            'bundler',
            '--target',
            'es2017',
            '--lib',
            'dom,esnext',
            '--skipLibCheck',
            Path.join(root, 'types.tsx'),
          ],
          { timeout: 120000 },
        )

        expect(checked.stdout).toMatchInlineSnapshot(`""`)

        const built = await Fixture.run(root, ['build', `--${bundler}`])

        expect(built.includes('Compiled successfully')).toMatchInlineSnapshot(
          `true`,
        )
        expect(
          built.includes('Built-in CSS support is being disabled'),
        ).toMatchInlineSnapshot(`false`)

        server = Fixture.start(root, ['start'])

        const url = await server.url
        const html = await (await fetch(url)).text()

        // The Suspense fallback and the streamed segment both arrive in one response.
        expect(html.includes('id="pending"')).toMatchInlineSnapshot(`true`)
        expect(html.includes('id="streamed"')).toMatchInlineSnapshot(`true`)
        expect(
          (html.match(/rel="stylesheet"/g) ?? []).length > 0,
        ).toMatchInlineSnapshot(`true`)

        const page = await browser.newPage()
        const errors: string[] = []

        page.on('pageerror', (error) => errors.push(error.message))
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(message.text())
        })

        await page.goto(url)
        await page.waitForFunction(
          'document.documentElement.dataset.ready === "true"',
        )

        expect(
          await page.evaluate('document.documentElement.dataset.identity'),
        ).toMatchInlineSnapshot(`"true"`)
        expect(await page.locator('#env').textContent()).toMatchInlineSnapshot(
          `"kept"`,
        )
        expect(
          await page.locator('#composed').textContent(),
        ).toMatchInlineSnapshot(`"composed"`)

        expect(await color(page, '#card')).toMatchInlineSnapshot(
          `"rgb(0, 102, 204)"`,
        )
        expect(await style(page, '#card', 'padding')).toMatchInlineSnapshot(
          `"16px"`,
        )
        expect(await style(page, 'body', 'margin')).toMatchInlineSnapshot(
          `"0px"`,
        )
        expect(await style(page, '#about-link', 'color')).toMatchInlineSnapshot(
          `"rgb(0, 0, 238)"`,
        )

        await page.waitForSelector('#streamed')

        expect(
          await style(page, '#streamed', 'font-weight'),
        ).toMatchInlineSnapshot(`"700"`)

        expect(await style(page, '#bar', 'width')).toMatchInlineSnapshot(
          `"100px"`,
        )
        expect(await style(page, '#bar', 'margin-top')).toMatchInlineSnapshot(
          `"12px"`,
        )
        expect(await color(page, '#bar')).toMatchInlineSnapshot(
          `"rgb(0, 0, 0)"`,
        )

        await page.evaluate('window.bar = document.querySelector("#bar")')
        await page.locator('#toggle').click()
        await page.waitForFunction(
          'getComputedStyle(document.querySelector("#bar")).width === "300px"',
        )

        expect(
          await page.evaluate('window.bar === document.querySelector("#bar")'),
        ).toMatchInlineSnapshot(`true`)
        expect(await style(page, '#bar', 'margin-top')).toMatchInlineSnapshot(
          `"0px"`,
        )
        expect(await color(page, '#bar')).toMatchInlineSnapshot(
          `"rgb(255, 255, 255)"`,
        )

        await page.locator('#about-link').click()
        await page.waitForSelector('#about')

        expect(await color(page, '#about')).toMatchInlineSnapshot(
          `"rgb(0, 102, 204)"`,
        )

        await page.locator('#home').click()
        await page.waitForSelector('#card')

        expect(await color(page, '#card')).toMatchInlineSnapshot(
          `"rgb(0, 102, 204)"`,
        )
        expect(errors).toMatchInlineSnapshot(`[]`)

        await page.close()
        await server.stop()

        server = Fixture.start(root, ['dev', `--${bundler}`])

        const development = await browser.newPage()
        const developmentErrors: string[] = []

        development.on('pageerror', (error) =>
          developmentErrors.push(error.message),
        )
        development.on('console', (message) => {
          if (message.type() === 'error') developmentErrors.push(message.text())
        })

        await development.goto(await server.url)
        await development.waitForFunction(
          'document.documentElement.dataset.ready === "true"',
        )

        expect(
          await development.evaluate(
            'document.documentElement.dataset.identity',
          ),
        ).toMatchInlineSnapshot(`"true"`)
        expect(await color(development, '#card')).toMatchInlineSnapshot(
          `"rgb(0, 102, 204)"`,
        )

        await development.evaluate('window.marker = true')
        await development.locator('#toggle').click()
        await development.waitForFunction(
          'getComputedStyle(document.querySelector("#bar")).width === "300px"',
        )

        // Imported config edits reach Server Components and client components without a reload.
        await edit(root, 'zyzz.config.ts', '#0066cc', '#117755')
        await development.waitForFunction(
          'getComputedStyle(document.querySelector("#card")).color === "rgb(17, 119, 85)"',
          undefined,
          { timeout: 60000 },
        )

        expect(
          await development.evaluate('window.marker === true'),
        ).toMatchInlineSnapshot(`true`)
        expect(
          await style(development, '#bar', 'background-color'),
        ).toMatchInlineSnapshot(`"rgb(17, 119, 85)"`)

        // Style edits keep client state through Fast Refresh.
        await edit(root, 'app/styles.ts', "height: '20px'", "height: '24px'")
        await development.waitForFunction(
          'getComputedStyle(document.querySelector("#bar")).height === "24px"',
          undefined,
          { timeout: 60000 },
        )

        expect(await style(development, '#bar', 'width')).toMatchInlineSnapshot(
          `"300px"`,
        )
        expect(
          await development.evaluate('window.marker === true'),
        ).toMatchInlineSnapshot(`true`)
        expect(developmentErrors).toMatchInlineSnapshot(`[]`)

        // A non-literal value fails extraction with a located diagnostic; restoring the
        // source recovers without restarting the server.
        await edit(
          root,
          'app/styles.ts',
          'fontWeight: 700',
          'fontWeight: globalThis.weight',
        )

        const failure = await (async () => {
          const deadline = Date.now() + 60000

          while (Date.now() < deadline) {
            const reported = developmentErrors.find((message) =>
              message.includes('Source.ExtractError'),
            )
            if (reported) return reported

            await new Promise((resolve) => setTimeout(resolve, 250))
          }

          throw new Error('Compilation failure was not reported.')
        })()

        expect(
          failure.includes(
            'app/app/styles.ts:338: Expected a literal string or number; expressions are not evaluated.',
          ),
        ).toMatchInlineSnapshot(`true`)

        await development.close()
        await edit(
          root,
          'app/styles.ts',
          'fontWeight: globalThis.weight',
          'fontWeight: 700',
        )

        const recovered = await browser.newPage()
        const recoveredErrors: string[] = []

        recovered.on('pageerror', (error) =>
          recoveredErrors.push(error.message),
        )
        recovered.on('console', (message) => {
          if (message.type() === 'error') recoveredErrors.push(message.text())
        })

        await recovered.goto(await server.url)
        await recovered.waitForFunction(
          'document.documentElement.dataset.ready === "true" && getComputedStyle(document.querySelector("#card")).color === "rgb(17, 119, 85)"',
          undefined,
          { timeout: 60000 },
        )

        expect(
          await style(recovered, '#card', 'padding'),
        ).toMatchInlineSnapshot(`"16px"`)
        expect(await style(recovered, '#bar', 'height')).toMatchInlineSnapshot(
          `"24px"`,
        )
        expect(recoveredErrors).toMatchInlineSnapshot(`[]`)
      } finally {
        await browser.close()
        await server?.stop()
        await Fs.rm(root, { force: true, recursive: true })
      }
    }, 900000)
  }
})
