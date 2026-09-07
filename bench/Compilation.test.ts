import * as Fs from 'node:fs/promises'
import * as Zlib from 'node:zlib'
import { chromium } from 'playwright'
import { expect, test } from 'vite-plus/test'
import { Style } from 'zyzz'
import { Css } from 'zyzz/web'
import * as Compilation from './Compilation.js'
import * as Corpus from './Corpus.js'

type Size = { brotli: number; gzip: number; raw: number }

test('temporary fixture roots do not change vanilla-extract delivery artifacts', async () => {
  const first = await Compilation.create(Corpus.cases[0])
  const second = await Compilation.create(Corpus.cases[0])
  try {
    const a = await Compilation.vanillaExtract(first)
    const b = await Compilation.vanillaExtract(second)
    expect({ css: a.css === b.css, javascript: a.javascript === b.javascript })
      .toMatchInlineSnapshot(`
        {
          "css": true,
          "javascript": true,
        }
      `)
  } finally {
    await Fs.rm(first.directory, { force: true, recursive: true })
    await Fs.rm(second.directory, { force: true, recursive: true })
  }
})

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
      // Every workload must beat every competitor in combined transfer.
      {
        const zyzz = sizes.get('zyzz')!
        for (const [library, size] of sizes) {
          if (library === 'zyzz') continue
          expect(
            {
              brotli: zyzz.brotli < size.brotli,
              gzip: zyzz.gzip < size.gzip,
              raw: zyzz.raw < size.raw,
            },
            `${library} / ${workload.name} transfer`,
          ).toMatchInlineSnapshot(`
            {
              "brotli": true,
              "gzip": true,
              "raw": true,
            }
          `)
        }
      }
    } finally {
      await browser.close()
      await Fs.rm(fixture.directory, { force: true, recursive: true })
    }
  }, 180_000)
}

test('final minification preserves combined classes and authored overrides', async () => {
  // Ordered A/B/A and opposing shorthand sequences are intentional fixtures.
  const styles = Style.define({
    first: { color: '#000', padding: '8px', paddingLeft: 0 },
    middle: { color: '#fff', paddingLeft: '3px' },
    last: { color: '#000', padding: '8px', paddingLeft: 0 },
    reverse: { paddingLeft: 0, padding: '12px' },
  })
  const output = Css.compile({ styles })
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.setContent('<!doctype html><body></body>')
    await page.addStyleTag({ content: Compilation.minify(output.css) })
    const result = await page.evaluate(
      (classes) =>
        [
          `${classes.middle} ${classes.first}`,
          `${classes.last} ${classes.middle}`,
          classes.reverse,
        ].map((className) => {
          const element = document.createElement('div')
          element.className = className
          document.body.append(element)
          const style = getComputedStyle(element)
          return { color: style.color, padding: style.padding }
        }),
      output.classes,
    )
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "color": "rgb(255, 255, 255)",
          "padding": "8px 8px 8px 3px",
        },
        {
          "color": "rgb(0, 0, 0)",
          "padding": "8px 8px 8px 0px",
        },
        {
          "color": "rgb(0, 0, 0)",
          "padding": "12px",
        },
      ]
    `)
  } finally {
    await browser.close()
  }
})
