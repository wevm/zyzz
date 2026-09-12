/** Verifies compiled styles through HTML and React rendering in Chromium. @module */
import * as Esbuild from 'esbuild'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import * as React from 'react'
import * as Server from 'react-dom/server'
import { describe, expect, test } from 'vite-plus/test'
import type { css } from 'zyzz'
import { Transform } from 'zyzz/compiler'

const source = `
import { css, Config } from 'zyzz';
import { Html } from 'zyzz/runtime';
const { css: htmlCss } = Config.create({ output: 'html' });
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
namespace style {
  export const card = css((values: { width: \`\${number}%\` }) => ({
    backgroundColor: '#0066cc', height: '20px', width: values.width,
  }))

  export const htmlCard = htmlCss((values: { width: \`\${number}%\` }) => ({
    backgroundColor: '#0066cc', height: '20px', width: values.width,
  }))
}
export function props(width: \`\${number}%\`, overrides = true) {
  return style.card({ width, ...(overrides ? { style: { marginTop: '12px', opacity: 0.5, colorScheme: 'dark', '--note': '"<&>"' } } : {}) });
}
export function html() { return Html.serialize({ ...style.htmlCard({ width: '25%', style: { marginTop: '12px', opacity: 0.5, colorScheme: 'dark', '--note': '"<&>"' } }), 'data-note': '"<&>' }); }
let root;
function Card({ values }) { React.useEffect(() => { document.documentElement.dataset.hydrated = "true" }, []); return React.createElement("div", { id: "card", ...values }); }
export function hydrate() { root = hydrateRoot(document.querySelector('#react'), React.createElement(Card, { values: props('25%') })); }
export function update() { flushSync(() => root.render(React.createElement(Card, { values: props('75%', false) }))); }
export function unmount() { flushSync(() => root.unmount()); }
export function updateDom(element) {
  const next = style.htmlCard({ width: '75%' });
  element.setAttribute('class', next.class);
  element.setAttribute('style', next.style ?? '');
}
`

describe('create', () => {
  test('compiled bindings survive SSR, hydration, updates, and attribute serialization', async () => {
    const result = Transform.compile({ moduleId: 'fixture/card.ts', source })

    const bundle = await Esbuild.build({
      alias: {
        'zyzz/runtime': Path.resolve('src/runtime/index.ts'),
        'zyzz/web': Path.resolve('src/web/index.ts'),
      },
      bundle: true,
      define: { 'process.env.NODE_ENV': '"production"' },
      format: 'iife',
      globalName: 'Fixture',
      metafile: true,
      stdin: { contents: result.code, loader: 'ts', resolveDir: process.cwd() },
      write: false,
    })

    expect(
      Object.values(bundle.metafile!.outputs).some((output) =>
        Object.entries(output.inputs).some(
          ([name, input]) =>
            input.bytesInOutput > 0 &&
            /oxc-parser|compiler\/|web\/Css/.test(name),
        ),
      ),
    ).toMatchInlineSnapshot(`false`)

    const browser = await chromium.launch({ headless: true })

    try {
      const page = await browser.newPage()
      const errors: string[] = []

      page.on('pageerror', (error) => errors.push(error.message))
      await page.setContent(
        '<style>' +
          result.css +
          '</style><main style="width:400px" id="react"></main><main style="width:400px" id="dom"></main>',
      )
      await page.addScriptTag({ content: bundle.outputFiles[0]!.text })

      const props = await page.evaluate<css.Props>('Fixture.props("25%")')
      const markup = Server.renderToString(
        React.createElement('div', { id: 'card', ...props }),
      )

      await page.evaluate((html) => {
        document.querySelector('#react')!.innerHTML = html
      }, markup)
      await page.evaluate(
        `window.original = document.querySelector('#card'); Fixture.hydrate(); document.querySelector('#dom').innerHTML = '<div id="plain" ' + Fixture.html() + '></div>'; window.plain = document.querySelector('#plain');`,
      )
      await page.waitForFunction(
        'document.querySelector("#card").style.opacity === "0.5"',
      )

      expect(
        await page.locator('#plain').getAttribute('data-note'),
      ).toMatchInlineSnapshot(`""<&>"`)
      expect(
        await page
          .locator('#plain')
          .evaluate((element) => getComputedStyle(element).width),
      ).toMatchInlineSnapshot(`"100px"`)
      expect(
        await page
          .locator('#plain')
          .evaluate((element) => getComputedStyle(element).colorScheme),
      ).toMatchInlineSnapshot(`"dark"`)
      expect(
        await page
          .locator('#plain')
          .evaluate((element) => getComputedStyle(element).marginTop),
      ).toMatchInlineSnapshot(`"12px"`)
      expect(
        await page
          .locator('#plain')
          .evaluate((element) => element.getAttributeNames().sort()),
      ).toMatchInlineSnapshot(`
        [
          "class",
          "data-note",
          "id",
          "style",
        ]
      `)

      // Wait for React's actual hydration commit before issuing an update.
      await page.waitForFunction(
        `document.documentElement.dataset.hydrated === 'true'`,
      )
      await page.evaluate('Fixture.update(); Fixture.updateDom(window.plain)')

      for (const id of ['card', 'plain']) {
        expect(
          await page
            .locator('#' + id)
            .evaluate((element) => getComputedStyle(element).width),
        ).toMatchInlineSnapshot(`"300px"`)
        expect(
          await page
            .locator('#' + id)
            .evaluate((element) => getComputedStyle(element).marginTop),
        ).toMatchInlineSnapshot(`"0px"`)
        expect(
          await page
            .locator('#' + id)
            .evaluate((element) => getComputedStyle(element).opacity),
        ).toMatchInlineSnapshot(`"1"`)
        expect(
          await page
            .locator('#' + id)
            .evaluate((element) =>
              (element as HTMLElement).style.getPropertyValue('--note'),
            ),
        ).toMatchInlineSnapshot(`""`)
      }

      expect(
        await page.evaluate(
          'window.original === document.querySelector("#card") && window.plain === document.querySelector("#plain")',
        ),
      ).toMatchInlineSnapshot(`true`)

      await page.evaluate('Fixture.unmount()')

      expect(await page.locator('#react').innerHTML()).toMatchInlineSnapshot(
        `""`,
      )
      expect(errors).toMatchInlineSnapshot(`[]`)
    } finally {
      await browser.close()
    }
  }, 30000)
})
