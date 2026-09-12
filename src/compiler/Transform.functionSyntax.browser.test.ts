/** Measures native composite CSS functions with defaults and conditional results. @module */
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'

describe('compile', () => {
  test('evaluates composite types, default values, and media-dependent results', async () => {
    const output = Transform.compile({
      moduleId: 'functions.ts',
      source: `import {cssFunction,global} from 'zyzz/web';
const size=cssFunction({parameters:[{name:'--size',syntax:'type(<length> | <percentage>)',default:'25%'}],returns:'type(<length> | <percentage>)',body:{result:'calc(var(--size) * 2)','@media (width < 300px)':{result:'var(--size)'}}});
const colors=cssFunction({parameters:[{name:'--colors',syntax:'<color>#'}],returns:'<color>#',body:{result:'var(--colors)'}});
global({main:{width:'200px'},'#gradient':{backgroundImage:\`linear-gradient(to right, \${colors('red, blue')})\`},'#default':{width:size()},'#fixed':{width:size('20px')}});`,
    })
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    const browser = await chromium.launch(
      executablePath ? { executablePath } : {},
    )
    try {
      const page = await browser.newPage({
        viewport: { width: 400, height: 300 },
      })
      await page.setContent(
        '<main><div id="default"></div><div id="fixed"></div><div id="gradient"></div></main>',
      )
      await page.addStyleTag({ content: output.css })

      expect(
        await page
          .locator('#default')
          .evaluate((element) => getComputedStyle(element).width),
      ).toMatchInlineSnapshot('"100px"')
      expect(
        await page
          .locator('#fixed')
          .evaluate((element) => getComputedStyle(element).width),
      ).toMatchInlineSnapshot('"40px"')
      expect(
        await page
          .locator('#gradient')
          .evaluate((element) => getComputedStyle(element).backgroundImage),
      ).toMatchInlineSnapshot(
        '"linear-gradient(to right, rgb(255, 0, 0), rgb(0, 0, 255))"',
      )
      await page.setViewportSize({ width: 200, height: 300 })
      expect(
        await page
          .locator('#default')
          .evaluate((element) => getComputedStyle(element).width),
      ).toMatchInlineSnapshot('"50px"')
      expect(
        await page
          .locator('#fixed')
          .evaluate((element) => getComputedStyle(element).width),
      ).toMatchInlineSnapshot('"20px"')
    } finally {
      await browser.close()
    }
  })
})
