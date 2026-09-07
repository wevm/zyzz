import * as Fs from 'node:fs/promises'
import { chromium } from 'playwright'
import { expect, test } from 'vite-plus/test'
import * as Compilation from './Compilation.js'

test('all compilation pipelines render the equivalent repeated and unique corpus', async () => {
  const browser = await chromium.launch()
  try {
    for (const [count, unique] of [
      [3, false],
      [1000, false],
      [1000, true],
    ] as const) {
      const fixture = await Compilation.create(count, unique)
      try {
        for (const compile of [
          Compilation.stylex,
          Compilation.tailwind,
          Compilation.vanillaExtract,
          Compilation.zyzz,
        ]) {
          const bundle = await compile(fixture)
          const page = await browser.newPage()
          try {
            await page.setContent(
              '<!doctype html><html><head></head><body></body></html>',
            )
            await page.addStyleTag({ content: bundle.css })
            await page.addScriptTag({ content: bundle.javascript })
            const result = await page.evaluate(() => {
              const { classes } = (
                window as unknown as { fixture: { classes: string[] } }
              ).fixture
              return classes.map((className) => {
                const element = document.createElement('div')
                element.className = className
                document.body.append(element)
                const style = getComputedStyle(element)
                return {
                  backgroundColor: style.backgroundColor,
                  borderColor: style.borderColor,
                  borderStyle: style.borderStyle,
                  borderWidth: style.borderWidth,
                  boxSizing: style.boxSizing,
                  color: style.color,
                  display: style.display,
                  padding: style.padding,
                }
              })
            })
            expect({
              countMatches: result.length === count,
              declarationsMatch: result.every(
                (value, index) =>
                  value.backgroundColor === 'rgb(255, 255, 255)' &&
                  value.borderColor === 'rgb(0, 0, 0)' &&
                  value.borderStyle === 'solid' &&
                  value.borderWidth === '1px' &&
                  value.boxSizing === 'border-box' &&
                  value.color === 'rgb(0, 0, 0)' &&
                  value.display === 'block' &&
                  value.padding === (unique ? `${index}px` : '12px'),
              ),
            }).toMatchInlineSnapshot(`
              {
                "countMatches": true,
                "declarationsMatch": true,
              }
            `)
          } finally {
            await page.close()
          }
        }
      } finally {
        await Fs.rm(fixture.directory, { force: true, recursive: true })
      }
    }
  } finally {
    await browser.close()
  }
}, 60_000)
