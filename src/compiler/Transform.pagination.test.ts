/** Verifies packed page rotation and fragmentation against independent printed controls. @module */
import * as Pdf from 'pdf-lib'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'

describe('compile', () => {
  test('prints every page orientation and preserves avoid-break fragmentation through packed imports', async () => {
    const browser = await chromium.launch(
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {},
    )
    try {
      const page = await browser.newPage()
      const geometry: Record<string, { height: number; width: number }> = {}
      const rotations: Record<string, Buffer> = {}
      for (const orientation of ['upright', 'rotate-left', 'rotate-right']) {
        const library = Graph.compile({
          modules: {
            'print.ts': `import {page} from 'zyzz/web';page({descriptors:{size:'200px 300px',margin:0,pageOrientation:${JSON.stringify(orientation)}}});`,
          },
        })
        const packed = Graph.compile({
          contracts: { 'print.js': library.contracts['print.ts']! },
          imports: { 'app.ts': { print: 'print.js' } },
          modules: { 'app.ts': `import 'print';` },
        })
        const documents = []
        for (const css of [
          packed.sharedCss!,
          `@page{size:200px 300px;margin:0;page-orientation:${orientation}}`,
        ]) {
          await page.setContent(
            '<div style="width:40px;height:20px;background:red">A</div>',
          )
          await page.addStyleTag({ content: css })
          documents.push(
            await Pdf.PDFDocument.load(
              await page.pdf({
                preferCSSPageSize: true,
                printBackground: true,
              }),
            ),
          )
        }
        const compiled = documents[0]!.getPage(0)
        const reference = documents[1]!.getPage(0)
        expect(
          Buffer.compare(stream(compiled), stream(reference)),
        ).toMatchInlineSnapshot('0')
        expect(
          JSON.stringify(compiled.getSize()) ===
            JSON.stringify(reference.getSize()),
        ).toMatchInlineSnapshot('true')
        const { height, width } = compiled.getSize()
        rotations[orientation] = stream(compiled)
        geometry[orientation] = {
          height: Math.round(height),
          width: Math.round(width),
        }
      }
      expect(geometry).toMatchInlineSnapshot(`
        {
          "rotate-left": {
            "height": 150,
            "width": 225,
          },
          "rotate-right": {
            "height": 150,
            "width": 225,
          },
          "upright": {
            "height": 225,
            "width": 150,
          },
        }
      `)
      expect(
        Buffer.compare(
          rotations['rotate-left']!,
          rotations['rotate-right']!,
        ) === 0,
      ).toMatchInlineSnapshot('false')

      const library = Graph.compile({
        modules: {
          'print.ts': `import {global,page} from 'zyzz/web';page({descriptors:{size:'200px 200px',margin:0}});global({body:{margin:0},article:{breakInside:'avoid',height:'120px',backgroundColor:'red'},'article:nth-child(2)':{backgroundColor:'blue'}});`,
        },
      })
      const packed = Graph.compile({
        contracts: { 'print.js': library.contracts['print.ts']! },
        imports: { 'app.ts': { print: 'print.js' } },
        modules: { 'app.ts': `import 'print';` },
      })
      const reference =
        '@page{size:200px 200px;margin:0}body{margin:0}article{break-inside:avoid;height:120px;background:red}article:nth-child(2){background:blue}'
      const documents = []
      for (const css of [
        packed.sharedCss!,
        reference,
        reference.replace('break-inside:avoid', 'break-inside:auto'),
      ]) {
        await page.setContent(
          '<article></article><article></article><article></article>',
        )
        await page.addStyleTag({ content: css })
        documents.push(
          await Pdf.PDFDocument.load(
            await page.pdf({ preferCSSPageSize: true, printBackground: true }),
          ),
        )
      }
      expect(documents.map((document) => document.getPageCount()))
        .toMatchInlineSnapshot(`
        [
          3,
          3,
          2,
        ]
      `)
      for (let index = 0; index < 3; index++)
        expect(
          Buffer.compare(
            stream(documents[0]!.getPage(index)),
            stream(documents[1]!.getPage(index)),
          ),
        ).toMatchInlineSnapshot('0')
    } finally {
      await browser.close()
    }
  }, 30_000)
})

function stream(page: Pdf.PDFPage): Buffer {
  const contents = page.node.Contents()
  const entries =
    contents instanceof Pdf.PDFArray ? contents.asArray() : [contents]
  return Buffer.concat(
    entries.map((entry) => {
      const value = page.doc.context.lookup(entry)
      if (!(value instanceof Pdf.PDFRawStream))
        throw new Error('Expected a PDF content stream.')
      return Buffer.from(Pdf.decodePDFRawStream(value).decode())
    }),
  )
}
