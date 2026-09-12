/** Compares compiled paged output with native CSS in Chromium-generated PDFs. @module */
import * as Pdf from 'pdf-lib'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Margins from '../../test/fixtures/PageMargins.js'

describe('compile', () => {
  test('prints named pages, pseudo-pages, counters, and all sixteen margin boxes', async () => {
    const output = Transform.compile({
      moduleId: 'print.ts',
      source: `import {global,page} from 'zyzz/web';
page({descriptors:{size:'200px 300px',margin:'30px','@top-left-corner':{content:'"TLC"'},'@top-left':{content:'"TL"'},'@top-center':{content:'"TC"'},'@top-right':{content:'"TR"'},'@top-right-corner':{content:'"TRC"'},'@bottom-left-corner':{content:'"BLC"'},'@bottom-left':{content:'"BL"'},'@bottom-center':{content:'counter(page) " / " counter(pages)'},'@bottom-right':{content:'"BR"'},'@bottom-right-corner':{content:'"BRC"'},'@left-top':{content:'"LT"'},'@left-middle':{content:'"LM"'},'@left-bottom':{content:'"LB"'},'@right-top':{content:'"RT"'},'@right-middle':{content:'"RM"'},'@right-bottom':{content:'"RB"'}}});
page({selector:':first',descriptors:{marginTop:'40px','@top-center':{content:'"First"'}}});
page({selector:':left',descriptors:{marginLeft:'40px'}});
page({selector:'wide',descriptors:{size:'400px 200px'}});
global({body:{margin:0,fontFamily:'Arial',fontSize:'8px'},section:{breakAfter:'page'},'section:last-child':{breakAfter:'auto'},'.wide':{page:'wide'}});`,
    })
    const reference = `@page {size:200px 300px;margin:30px;@top-left-corner{content:"TLC"}@top-left{content:"TL"}@top-center{content:"TC"}@top-right{content:"TR"}@top-right-corner{content:"TRC"}@bottom-left-corner{content:"BLC"}@bottom-left{content:"BL"}@bottom-center{content:counter(page) " / " counter(pages)}@bottom-right{content:"BR"}@bottom-right-corner{content:"BRC"}@left-top{content:"LT"}@left-middle{content:"LM"}@left-bottom{content:"LB"}@right-top{content:"RT"}@right-middle{content:"RM"}@right-bottom{content:"RB"}}
@page :first {margin-top:40px;@top-center{content:"First"}}
@page :left {margin-left:40px}
@page wide {size:400px 200px}
body{margin:0;font-family:Arial;font-size:8px}section{break-after:page}section:last-child{break-after:auto}.wide{page:wide}`
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    const browser = await chromium.launch(
      executablePath ? { executablePath } : {},
    )
    try {
      const page = await browser.newPage()
      const html =
        '<section>One</section><section class="wide">Two</section><section>Three</section>'
      await page.setContent(html)
      await page.addStyleTag({ content: output.css })
      const compiled = await Pdf.PDFDocument.load(
        await page.pdf({ preferCSSPageSize: true, printBackground: true }),
      )
      await page.setContent(html)
      await page.addStyleTag({ content: reference })
      const native = await Pdf.PDFDocument.load(
        await page.pdf({ preferCSSPageSize: true, printBackground: true }),
      )

      expect(
        compiled.getPages().map((page) => {
          const { width, height } = page.getSize()
          return { height: Math.round(height), width: Math.round(width) }
        }),
      ).toMatchInlineSnapshot(`
          [
            {
              "height": 225,
              "width": 150,
            },
            {
              "height": 150,
              "width": 300,
            },
            {
              "height": 225,
              "width": 150,
            },
          ]
        `)
      expect(native.getPageCount()).toMatchInlineSnapshot('3')
      for (const [index, page] of compiled.getPages().entries()) {
        const reference = native.getPage(index)

        expect(
          Buffer.compare(streams(page), streams(reference)) === 0,
        ).toMatchInlineSnapshot('true')
      }
      // Each box must affect the PDF; equality alone could hide rules ignored by both paths.
      for (const box of Margins.boxes) {
        await page.setContent(html)
        await page.addStyleTag({
          content: reference.replace(new RegExp(`${box}\\{[^}]*\\}`, 'g'), ''),
        })
        const omitted = await Pdf.PDFDocument.load(
          await page.pdf({ preferCSSPageSize: true, printBackground: true }),
        )
        expect(
          Buffer.compare(
            streams(native.getPage(1)),
            streams(omitted.getPage(1)),
          ) === 0,
        ).toMatchInlineSnapshot('false')
      }
    } finally {
      await browser.close()
    }
  })
})

function streams(page: Pdf.PDFPage) {
  const contents = page.node.Contents()
  const entries =
    contents instanceof Pdf.PDFArray ? contents.asArray() : [contents]
  return Buffer.concat(
    entries.map((entry) => {
      const stream = page.doc.context.lookup(entry)
      if (!(stream instanceof Pdf.PDFRawStream))
        throw new Error('Expected a PDF page content stream.')
      return Buffer.from(Pdf.decodePDFRawStream(stream).decode())
    }),
  )
}
