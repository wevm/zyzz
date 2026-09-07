import * as Fs from 'node:fs/promises'
import * as Zlib from 'node:zlib'
import { chromium } from 'playwright'
import { expect, test } from 'vite-plus/test'
import * as Compilation from './Compilation.js'
import * as Corpus from './Corpus.js'

type Size = { brotli: number; gzip: number; raw: number }

for (const workload of Corpus.cases) {
  test(`compilers render equivalent CSS / ${workload.name}`, async () => {
    const fixture = await Compilation.create(workload)
    const browser = await chromium.launch()
    try {
      const sizes = new Map<string, Size>()
      for (const [library, compile] of Object.entries(Compilation.compilers)) {
        const bundle = await compile(fixture)
        const values = [bundle.css, bundle.javascript]
        sizes.set(library, {
          brotli: values.reduce(
            (total, value) => total + Zlib.brotliCompressSync(value).byteLength,
            0,
          ),
          gzip: values.reduce(
            (total, value) => total + Zlib.gzipSync(value).byteLength,
            0,
          ),
          raw: values.reduce(
            (total, value) => total + Buffer.byteLength(value),
            0,
          ),
        })
        const page = await browser.newPage()
        try {
          await page.setContent(
            '<!doctype html><html><head></head><body></body></html>',
          )
          await page.addStyleTag({ content: bundle.css })
          await page.addScriptTag({ content: bundle.javascript })
          const result = await page.evaluate((styles) => {
            const { classes } = (
              window as unknown as { fixture: { classes: string[] } }
            ).fixture
            const properties = [
              ...new Set(styles.flatMap((style) => Object.keys(style))),
            ]
            const differences: unknown[] = []
            for (const [index, style] of styles.entries()) {
              const actual = document.createElement('div')
              const reference = document.createElement('div')
              actual.className = classes[index] ?? ''
              // The browser interprets the original literal CSS independently of every compiler.
              for (const [property, value] of Object.entries(style))
                reference.style.setProperty(
                  property.replace(
                    /[A-Z]/g,
                    (letter) => `-${letter.toLowerCase()}`,
                  ),
                  String(value),
                )
              document.body.append(actual, reference)
              const actualStyle = getComputedStyle(actual)
              const referenceStyle = getComputedStyle(reference)
              for (const property of properties) {
                const key = property.replace(
                  /[A-Z]/g,
                  (letter) => `-${letter.toLowerCase()}`,
                )
                const actualValue = actualStyle.getPropertyValue(key)
                const expectedValue = referenceStyle.getPropertyValue(key)
                if (actualValue !== expectedValue && differences.length < 5)
                  differences.push({
                    actual: actualValue,
                    expected: expectedValue,
                    index,
                    property,
                  })
              }
              actual.remove()
              reference.remove()
            }
            return {
              countMatches: classes.length === styles.length,
              differences,
            }
          }, Corpus.styles(workload))
          expect(result, `${library} / ${workload.name}`)
            .toMatchInlineSnapshot(`
            {
              "countMatches": true,
              "differences": [],
            }
          `)
        } finally {
          await page.close()
        }
      }
      // Preserve established gates. New stress cases report gaps before budgets are accepted.
      if (['repeated', 'small', 'unique'].includes(workload.name)) {
        const stylex = sizes.get('stylex')!
        const zyzz = sizes.get('zyzz')!
        expect({
          brotli: zyzz.brotli < stylex.brotli,
          gzip: zyzz.gzip < stylex.gzip,
          raw: zyzz.raw < stylex.raw,
        }).toMatchInlineSnapshot(`
          {
            "brotli": true,
            "gzip": true,
            "raw": true,
          }
        `)
      }
    } finally {
      await browser.close()
      await Fs.rm(fixture.directory, { force: true, recursive: true })
    }
  }, 180_000)
}
