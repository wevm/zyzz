/** Verifies palette descriptor preservation and real color-font rendering through packed compilation. @module */
import * as Trace from '@jridgewell/trace-mapping'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'
import * as Font from '../../test/fixtures/ColorFont.js'

describe('compile', () => {
  test('preserves font-family lists and descriptor maps across packed aliases', () => {
    const library = Graph.compile({
      modules: {
        'palette.ts': `import {fontPaletteValues} from 'zyzz/web';\nexport const palette=fontPaletteValues({fontFamily:'Evidence, "Second Family"',basePalette:1,overrideColors:'0 red, 0 blue'});`,
      },
    })
    const output = Graph.compile({
      contracts: { 'lib/palette.js': library.contracts['palette.ts']! },
      imports: { 'app.ts': { lib: 'lib/palette.js', 'zyzz/web': null } },
      modules: {
        'app.ts': `import {palette as blue} from 'lib';import {global} from 'zyzz/web';global({body:{fontPalette:blue}});`,
      },
    })
    expect(output.sharedCss).toMatchInlineSnapshot(`
      "@font-palette-values --z-fontpalettevaluespe2tjfjj233v-70-61-6c-65-74-74-65{font-family:Evidence, "Second Family";base-palette:1;override-colors:0 red, 0 blue;}
      body{font-palette:--z-fontpalettevaluespe2tjfjj233v-70-61-6c-65-74-74-65;}"
    `)
    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.sharedCssMap!), {
        line: 1,
        column: 0,
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 21,
        "line": 2,
        "name": null,
        "source": "lib/palette.ts",
      }
    `)
  })

  test('rejects conflicting packed palette definitions after parser shielding', () => {
    const library = Graph.compile({
      modules: {
        'palette.ts': `import {fontPaletteValues} from 'zyzz/web';export const palette=fontPaletteValues({fontFamily:'A, B',basePalette:1});`,
      },
    })
    const contract = library.contracts['palette.ts']!
    expect(() =>
      Graph.compile({
        contracts: {
          'first.js': contract,
          'second.js': contract.replaceAll('base-palette:1', 'base-palette:0'),
        },
        imports: { 'app.ts': { first: 'first.js', second: 'second.js' } },
        modules: { 'app.ts': `import 'first';import 'second';` },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: second.js:0: Conflicting packed stylesheet contributions.]`,
    )
  })

  test('matches native palette keywords, index fallbacks, and color overrides in Chromium', async () => {
    const cases = [
      { options: {}, native: '' },
      { options: { basePalette: 1 }, native: 'base-palette:1' },
      { options: { basePalette: 'light' }, native: 'base-palette:light' },
      { options: { basePalette: 'dark' }, native: 'base-palette:dark' },
      { options: { basePalette: 99 }, native: 'base-palette:99' },
      {
        options: { basePalette: 1, overrideColors: '0 red' },
        native: 'base-palette:1;override-colors:0 red',
      },
      {
        options: { overrideColors: '0 red, 0 blue, 99 green' },
        native: 'override-colors:0 red,0 blue,99 green',
      },
      {
        options: { overrideColors: '0 rgb(0 128 0 / .5)' },
        native: 'override-colors:0 rgb(0 128 0 / .5)',
      },
      {
        options: { overrideColors: '0 color(display-p3 0 1 0)' },
        native: 'override-colors:0 color(display-p3 0 1 0)',
      },
      {
        options: {
          fontFamily: 'PaletteEvidence, "Palette Alias"',
          basePalette: 1,
        },
        native: 'font-family:PaletteEvidence, "Palette Alias";base-palette:1',
      },
    ]
    const library = Graph.compile({
      modules: {
        'palettes.ts': `import {fontFace,fontPaletteValues,global} from 'zyzz/web';fontFace({fontFamily:'PaletteEvidence',src:${JSON.stringify(`url("${Font.url}")`)}});fontFace({fontFamily:'Palette Alias',src:${JSON.stringify(`url("${Font.url}")`)}});global({'#compiled9,#native9':{fontFamily:'"Palette Alias"'}});${cases.map((entry, index) => `export const p${index}=fontPaletteValues(${JSON.stringify({ fontFamily: 'PaletteEvidence', ...entry.options })});global({'#compiled${index}':{fontPalette:p${index}}});`).join('\n')}`,
      },
    })
    const output = Graph.compile({
      contracts: { 'lib.js': library.contracts['palettes.ts']! },
      imports: { 'app.ts': { lib: 'lib.js' } },
      modules: { 'app.ts': `import 'lib';` },
    })
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    const browser = await chromium.launch(
      executablePath ? { executablePath } : {},
    )
    try {
      const page = await browser.newPage()
      await page.setContent(
        cases
          .map(
            (_, index) =>
              `<div id="compiled${index}" class="font">A</div><div id="native${index}" class="font">A</div>`,
          )
          .join(''),
      )
      await page.addStyleTag({ content: output.sharedCss! })
      await page.addStyleTag({
        content:
          '.font{font:40px PaletteEvidence;width:60px;height:40px;background:white}' +
          cases
            .map(
              (entry, index) =>
                `@font-palette-values --native${index}{font-family:PaletteEvidence;${entry.native}}#native${index}{font-palette:--native${index}}`,
            )
            .join(''),
      })
      await page.evaluate(() => document.fonts.ready)
      expect(
        await page.evaluate(() => document.fonts.check('40px PaletteEvidence')),
      ).toMatchInlineSnapshot('true')
      const images = []
      for (let index = 0; index < cases.length; index++) {
        const compiled = await page.locator(`#compiled${index}`).screenshot()
        const native = await page.locator(`#native${index}`).screenshot()
        expect(Buffer.compare(compiled, native)).toMatchInlineSnapshot('0')
        images.push(compiled)
      }
      expect(
        Buffer.compare(images[0]!, images[1]!) === 0,
      ).toMatchInlineSnapshot('false')
      for (const index of [2, 3, 4, 5])
        expect(
          Buffer.compare(images[0]!, images[index]!),
        ).toMatchInlineSnapshot('0')
      expect(Buffer.compare(images[1]!, images[6]!)).toMatchInlineSnapshot('0')
      expect(Buffer.compare(images[1]!, images[9]!)).toMatchInlineSnapshot('0')
      for (const index of [7, 8])
        expect(
          Buffer.compare(images[0]!, images[index]!) === 0,
        ).toMatchInlineSnapshot('false')
    } finally {
      await browser.close()
    }
  })
})
