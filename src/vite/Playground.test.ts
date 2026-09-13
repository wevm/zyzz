/** Exercises the runnable React playground in the Vite dev server. @module */
import * as ChildProcess from 'node:child_process'
import * as Path from 'node:path'
import * as Util from 'node:util'
import { chromium } from 'playwright'
import * as Vite from 'vite'
import { describe, expect, test } from 'vite-plus/test'

describe('zyzz', () => {
  test('renders the React playground through its consumer config', async () => {
    const browser = await chromium.launch({
      args: ['--no-sandbox'],
      headless: true,
    })
    const config = {
      configFile: Path.resolve('examples/react/vite.config.ts'),
      configLoader: 'runner' as const,
      logLevel: 'silent' as const,
      root: Path.resolve('examples/react'),
    }

    try {
      await Util.promisify(ChildProcess.execFile)('pnpm', ['dev'], {
        timeout: 60000,
      })
      const server = await Vite.createServer({
        ...config,
        server: { host: '127.0.0.1', port: 0 },
      })
      await server.listen()

      const page = await browser.newPage({
        colorScheme: 'light',
        viewport: { height: 1100, width: 1280 },
      })
      const errors: string[] = []

      page.on('pageerror', (error) => errors.push(error.message))
      page.on('response', (response) => {
        if (response.status() >= 400)
          errors.push(`${response.status()} ${response.url()}`)
      })

      try {
        await page.goto(server.resolvedUrls!.local[0]!)
        await page.getByRole('heading', { name: 'Zyzz examples' }).waitFor()

        expect(
          await page
            .locator('main')
            .evaluate((node) => getComputedStyle(node).backgroundColor),
        ).toMatchInlineSnapshot('"rgb(255, 255, 255)"')
        await page.getByRole('button', { name: 'Always mint + dark' }).hover()

        expect(
          await page
            .getByRole('button', { name: 'Always mint + dark' })
            .evaluate((node) => getComputedStyle(node).color),
        ).toMatchInlineSnapshot('"rgb(110, 231, 183)"')

        await page.getByRole('button', { exact: true, name: 'Mint' }).click()
        await page
          .getByRole('combobox', { name: 'Color scheme' })
          .selectOption('dark')
        await page.waitForFunction(
          () =>
            getComputedStyle(document.querySelector('main')!)
              .backgroundColor === 'rgb(24, 24, 24)',
        )

        await page.getByRole('button', { name: 'Toggle state' }).hover()

        expect(
          await page
            .getByRole('button', { name: 'Toggle state' })
            .evaluate((node) => getComputedStyle(node).color),
        ).toMatchInlineSnapshot('"rgb(110, 231, 183)"')

        await page
          .getByRole('combobox', { name: 'Color scheme' })
          .selectOption('light')
        await page
          .getByRole('slider', { name: 'Amount', exact: true })
          .press('End')
        await page.waitForFunction(
          () => document.querySelector('output')?.textContent === '100%',
        )

        expect(
          await page
            .getByTestId('dynamic-bar')
            .evaluate(
              (node) =>
                getComputedStyle(node).width ===
                getComputedStyle(node.parentElement!).width,
            ),
        ).toMatchInlineSnapshot('true')
        expect(
          await page
            .getByTestId('variable-bar')
            .evaluate((node) => getComputedStyle(node).opacity),
        ).toMatchInlineSnapshot('"1"')

        await page.getByRole('checkbox', { name: 'Highlight children' }).check()

        expect(
          await page
            .getByText('Item 1', { exact: true })
            .evaluate((node) => getComputedStyle(node).color),
        ).toMatchInlineSnapshot('"rgb(4, 120, 87)"')
        expect(
          await page
            .getByText('Item 2', { exact: true })
            .evaluate((node) => getComputedStyle(node).backgroundColor),
        ).toMatchInlineSnapshot('"rgb(245, 245, 245)"')

        expect(
          await page
            .getByTestId('query-content')
            .evaluate(
              (node) =>
                getComputedStyle(node).gridTemplateColumns.split(' ').length,
            ),
        ).toMatchInlineSnapshot('2')
        await page
          .getByRole('slider', { name: 'Container width' })
          .press('Home')
        await page.waitForFunction(
          () =>
            getComputedStyle(
              document.querySelector('[data-testid="query-content"]')!,
            ).gridTemplateColumns.split(' ').length === 1,
        )

        expect(
          await page
            .getByTestId('query-content')
            .evaluate(
              (node) =>
                getComputedStyle(node).gridTemplateColumns.split(' ').length,
            ),
        ).toMatchInlineSnapshot('1')
        expect(
          await page
            .getByText('Scoped accent', { exact: true })
            .evaluate((node) => getComputedStyle(node).color),
        ).toMatchInlineSnapshot('"rgb(4, 120, 87)"')
        expect(
          await page
            .getByText('Outside scope', { exact: true })
            .evaluate((node) => getComputedStyle(node).color),
        ).toMatchInlineSnapshot('"rgb(17, 17, 17)"')

        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.getByRole('button', { name: 'Replay animation' }).click()

        expect(
          await page
            .getByTestId('motion-dot')
            .evaluate((node) => getComputedStyle(node).animationName),
        ).toMatchInlineSnapshot('"none"')
        expect(
          await page.getByTestId('motion-dot').evaluate(
            (node) =>
              new Promise<number>((resolve) => {
                const image = new Image()
                image.onload = () => resolve(image.naturalWidth)
                image.onerror = () => resolve(0)
                image.src = getComputedStyle(
                  node.parentElement!,
                ).backgroundImage.slice(5, -2)
              }),
          ),
        ).toMatchInlineSnapshot('24')

        await page
          .getByText('Advanced stylesheet features', { exact: true })
          .click()
        await page
          .getByRole('button', { name: 'Open anchored popover' })
          .click()

        expect(
          await page
            .locator('#anchor-preview')
            .evaluate((node) => node.matches(':popover-open')),
        ).toMatchInlineSnapshot('true')
        expect(
          await page
            .getByRole('img', { name: 'Namespace styled circle' })
            .evaluate((node) => getComputedStyle(node).color),
        ).toMatchInlineSnapshot('"rgb(4, 120, 87)"')

        await page.setViewportSize({ height: 844, width: 390 })

        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toMatchInlineSnapshot('true')
        expect(errors).toMatchInlineSnapshot('[]')
      } finally {
        await page.close()
        await server.close()
      }
    } finally {
      await browser.close()
    }
  }, 120000)
})
