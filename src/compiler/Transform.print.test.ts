/** Verifies packed page geometry, printer marks, and ICC color painting in a real print engine. @module */
import * as Fs from 'node:fs/promises'
import * as Pdf from 'pdf-lib'
import { describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'
import * as Profile from '../../test/fixtures/ColorProfile.js'
import * as WeasyPrint from '../../test/fixtures/WeasyPrint.js'

describe('compile', () => {
  test('prints packed bleed and marks with independent geometry and raster controls', async () => {
    const library = Graph.compile({
      modules: {
        'print.ts': `import {page} from 'zyzz/web';page({descriptors:{size:'100mm 100mm',margin:'10mm',bleed:'3mm',marks:'crop cross'}});`,
      },
    })
    const packed = Graph.compile({
      contracts: { 'lib.js': library.contracts['print.ts']! },
      imports: { 'app.ts': { lib: 'lib.js' } },
      modules: { 'app.ts': `import 'lib';` },
    })
    const compiled = await WeasyPrint.render(
      `<style>${packed.sharedCss}</style>`,
    )
    const reference = await WeasyPrint.render(
      '<style>@page{size:100mm 100mm;margin:10mm;bleed:3mm;marks:crop cross}</style>',
    )
    const control = await WeasyPrint.render(
      '<style>@page{size:100mm 100mm;margin:10mm;bleed:3mm;marks:none}</style>',
    )

    expect(
      Buffer.compare(compiled.pixels, reference.pixels),
    ).toMatchInlineSnapshot('0')
    expect(
      compiled.pixels.some((channel) => channel < 250),
    ).toMatchInlineSnapshot('true')
    expect(
      control.pixels.every((channel) => channel === 255),
    ).toMatchInlineSnapshot('true')

    const document = await Pdf.PDFDocument.load(compiled.pdf)
    const page = document.getPage(0)
    for (const name of ['BleedBox', 'MediaBox']) {
      const box = page.node.lookup(Pdf.PDFName.of(name), Pdf.PDFArray)
      expect(
        box
          .asArray()
          .map(
            (value) =>
              Math.round((value as Pdf.PDFNumber).asNumber() * 1000) / 1000,
          ),
      ).toMatchInlineSnapshot(`
        [
          -8.504,
          -8.504,
          291.969,
          291.969,
        ]
      `)
    }
    expect(page.getTrimBox()).toMatchInlineSnapshot(`
      {
        "height": 283.464567,
        "width": 283.464567,
        "x": 0,
        "y": 0,
      }
    `)
  }, 30_000)

  test('paints packed ICC references and reports unsupported relative-profile rendering', async () => {
    const library = Graph.compile({
      modules: {
        'colors.ts': `import {colorProfile,global} from 'zyzz/web';export const profile=colorProfile({src:${JSON.stringify(`url("${Profile.url}")`)},components:'r,g,b'});global({'#sample':{backgroundColor:\`color(\${profile} 1 0 0)\`}});`,
      },
    })
    const packed = Graph.compile({
      contracts: { 'lib.js': library.contracts['colors.ts']! },
      imports: { 'app.ts': { lib: 'lib.js' } },
      modules: { 'app.ts': `import 'lib';` },
    })
    const html = (css: string) =>
      `<style>@page{size:40px 40px;margin:0}body{margin:0}#sample{width:40px;height:40px}${css}</style><div id="sample"></div>`
    const compiled = await WeasyPrint.render(html(packed.sharedCss!))
    const reference = await WeasyPrint.render(
      html(
        `@color-profile --reference{src:url("${Profile.url}");components:r,g,b}#sample{background:color(--reference 1 0 0)}`,
      ),
    )
    const relative = await WeasyPrint.render(
      html(
        `@color-profile --reference{src:url("${Profile.url}");components:r,g,b}#sample{background:color(from color(--reference 1 0 0) --reference r g b)}`,
      ),
    )

    expect(
      Buffer.compare(compiled.pixels, reference.pixels),
    ).toMatchInlineSnapshot('0')
    const center =
      (Math.floor(compiled.height / 2) * compiled.width +
        Math.floor(compiled.width / 2)) *
      3
    expect([...compiled.pixels.subarray(center, center + 3)])
      .toMatchInlineSnapshot(`
      [
        255,
        0,
        0,
      ]
    `)
    expect(
      relative.pixels.every((channel) => channel === 255),
    ).toMatchInlineSnapshot('true')

    const document = await Pdf.PDFDocument.load(compiled.pdf)
    const resources = document.getPage(0).node.Resources()!
    const spaces = resources.lookup(Pdf.PDFName.of('ColorSpace'), Pdf.PDFDict)
    const custom = spaces
      .entries()
      .find(([name]) => name.asString().startsWith('/--z-'))!
    const space = document.context.lookup(custom[1], Pdf.PDFArray)
    expect(space.get(0).toString()).toMatchInlineSnapshot('"/ICCBased"')
    const profile = document.context.lookup(space.get(1))
    if (!(profile instanceof Pdf.PDFRawStream))
      throw new Error('Expected an embedded ICC profile stream.')

    expect(
      profile.dict.lookup(Pdf.PDFName.of('N'), Pdf.PDFNumber).asNumber(),
    ).toMatchInlineSnapshot('3')
    expect(
      Buffer.compare(
        Buffer.from(Pdf.decodePDFRawStream(profile).decode()),
        Buffer.from(Profile.url.split(',')[1]!, 'base64'),
      ),
    ).toMatchInlineSnapshot('0')

    await Fs.mkdir('test-results', { recursive: true })
    await Fs.writeFile(
      'test-results/at-rule-print-capabilities.json',
      JSON.stringify(
        {
          engine: compiled.version,
          features: {
            iccPainting: 'verified',
            relativeProfileColors: 'unsupported',
            renderingIntent: 'unverified',
          },
        },
        null,
        2,
      ),
    )
  }, 30_000)
})
