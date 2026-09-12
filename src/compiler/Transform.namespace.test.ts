/** Verifies namespace token identities through source, packed modules, maps, and native selectors. @module */
import * as Trace from '@jridgewell/trace-mapping'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Transform } from 'zyzz/compiler'

const source = `import {namespace,global} from 'zyzz/web';
namespace({prefix:'svg',uri:'urn:obsolete'});
global({'svg|rect':{fill:'red'},'图|circle':{fill:'blue'},'[svg|mark]':{stroke:'green'}});
namespace({prefix:${JSON.stringify('\\73 vg')},uri:'http://www.w3.org/2000/svg'});
namespace({prefix:'图',uri:'http://www.w3.org/2000/svg'});`

describe('compile', () => {
  test('preserves namespace URI control characters through packed output and native matching', async () => {
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    const browser = await chromium.launch(
      executablePath ? { executablePath } : {},
    )
    try {
      const page = await browser.newPage()
      for (const uri of [
        'urn:line\nbreak',
        'urn:tab\treturn\r',
        'urn:quote"slash\\',
        'urn:control\u0001',
      ]) {
        const library = Graph.compile({
          modules: {
            'uri.ts': `import {namespace,global} from 'zyzz/web';namespace({prefix:'s',uri:${JSON.stringify(uri)}});global({'s|item':{color:'red'}});`,
          },
        })
        const output = Graph.compile({
          contracts: { 'lib.js': library.contracts['uri.ts']! },
          imports: { 'app.ts': { lib: 'lib.js' } },
          modules: { 'app.ts': `import 'lib';` },
        })
        await page.setContent('<body></body>')
        await page.evaluate((uri) => {
          const element = document.createElementNS(uri, 'item')
          element.id = 'target'
          document.body.append(element)
        }, uri)
        await page.addStyleTag({ content: output.sharedCss! })
        expect(
          await page
            .locator('#target')
            .evaluate((element) => getComputedStyle(element).color),
        ).toMatchInlineSnapshot('"rgb(255, 0, 0)"')
      }
    } finally {
      await browser.close()
    }
  })
  test('resolves equivalent escaped prefixes using the last module binding and retains packed maps', () => {
    const library = Graph.compile({ modules: { 'shapes.ts': source } })
    const output = Graph.compile({
      contracts: { 'lib/shapes.js': library.contracts['shapes.ts']! },
      imports: { 'app.ts': { shapes: 'lib/shapes.js' } },
      modules: { 'app.ts': `import 'shapes';` },
    })

    expect(output.sharedCss).toMatchInlineSnapshot(`
      "@namespace z-n1tmgscii6bosa-17 "urn:obsolete";
      @namespace z-n1tmgscii6bosa-4z "http://www.w3.org/2000/svg";
      @namespace z-n1tmgscii6bosa-6r "http://www.w3.org/2000/svg";
      z-n1tmgscii6bosa-4z|rect {
        fill: red;
      }
      z-n1tmgscii6bosa-6r|circle {
        fill: #00f;
      }
      [z-n1tmgscii6bosa-4z|mark] {
        stroke: green;
      }"
    `)
    expect(
      JSON.parse(library.contracts['shapes.ts']!).stylesheets[0].namespaces,
    ).toMatchInlineSnapshot(`
      [
        {
          "kind": "namespace",
          "name": "z-n1tmgscii6bosa-17",
          "prefix": "svg",
          "uri": "urn:obsolete",
        },
        {
          "kind": "namespace",
          "name": "z-n1tmgscii6bosa-4z",
          "prefix": "\\73 vg",
          "uri": "http://www.w3.org/2000/svg",
        },
        {
          "kind": "namespace",
          "name": "z-n1tmgscii6bosa-6r",
          "prefix": "图",
          "uri": "http://www.w3.org/2000/svg",
        },
      ]
    `)
    const line =
      output
        .sharedCss!.split('\n')
        .findIndex((line) => line.includes('fill: red')) + 1
    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.sharedCssMap!), {
        line,
        column: 2,
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 0,
        "line": 3,
        "name": null,
        "source": "lib/shapes.ts",
      }
    `)
  })

  test.each(['图', '--', '\\31 a', '\\|', '\\1f600 '])(
    'links the CSS identifier %s in source and packed selectors',
    (prefix) => {
      const library = Graph.compile({
        modules: {
          'rules.ts': `import {namespace,global} from 'zyzz/web';namespace({prefix:${JSON.stringify(prefix)},uri:''});global({${JSON.stringify(`${prefix}|item`)}:{color:'red'}});`,
        },
      })
      const output = Graph.compile({
        contracts: { 'lib.js': library.contracts['rules.ts']! },
        imports: { 'app.ts': { lib: 'lib.js' } },
        modules: { 'app.ts': `import 'lib';` },
      })
      expect(output.sharedCss?.includes('|item')).toMatchInlineSnapshot('true')
      expect(output.sharedCss?.includes('color: red')).toMatchInlineSnapshot(
        'true',
      )
    },
  )

  test.each([
    '',
    '1abc',
    'a\\',
    'a b',
    'a\\\nb',
    'svg "urn:injected"; @namespace bad',
  ])('rejects malformed source and packed prefixes: %s', (prefix) => {
    expect(() =>
      Transform.compile({
        moduleId: 'bad.ts',
        source: `import {namespace} from 'zyzz/web';namespace({prefix:${JSON.stringify(prefix)},uri:'urn:a'});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: bad.ts:35: Expected a namespace URI and optional identifier prefix.]`,
    )
    const library = Graph.compile({
      modules: {
        'rules.ts': `import {namespace,global} from 'zyzz/web';namespace({prefix:'valid',uri:'urn:a'});global({'valid|item':{color:'red'}});`,
      },
    })
    const contract = JSON.parse(library.contracts['rules.ts']!)
    for (const section of contract.stylesheets)
      section.namespaces[0].prefix = prefix
    expect(() =>
      Graph.compile({
        contracts: { 'lib.js': JSON.stringify(contract) },
        imports: { 'app.ts': { lib: 'lib.js' } },
        modules: { 'app.ts': `import 'lib';` },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: lib.js:0: Invalid library contract: Invalid packed namespace.]`,
    )
  })

  test('keeps empty and default namespaces distinct in Chromium', async () => {
    const output = Graph.compile({
      modules: {
        'shapes.ts': source,
        'default.ts': `import {namespace,global} from 'zyzz/web';namespace({uri:'urn:obsolete'});global({'.box':{color:'purple'},':is(.box)':{backgroundColor:'yellow'}});namespace({uri:'http://www.w3.org/1999/xhtml'});`,
        'empty.ts': `import {namespace,global} from 'zyzz/web';namespace({prefix:'empty',uri:''});global({'empty|item':{color:'orange'},'*|item':{backgroundColor:'pink'}});`,
      },
    })
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    const browser = await chromium.launch(
      executablePath ? { executablePath } : {},
    )
    try {
      const page = await browser.newPage()
      const values: string[][][] = []
      for (const css of [
        output.sharedCss!,
        `@namespace svg "urn:obsolete";@namespace svg "http://www.w3.org/2000/svg";@namespace 图 "http://www.w3.org/2000/svg";svg|rect{fill:red}图|circle{fill:blue}[svg|mark]{stroke:green}`,
        `@namespace "urn:obsolete";@namespace "http://www.w3.org/1999/xhtml";.box{color:purple}:is(.box){background-color:yellow}`,
        `@namespace empty "";empty|item{color:orange}*|item{background-color:pink}`,
      ]) {
        if (values.length === 0 || css.startsWith('@namespace svg')) {
          await page.setContent(
            '<div id="html" class="box"></div><svg><rect id="rect" class="box"/><circle id="circle"/></svg><item id="html-item"></item>',
          )
          await page.evaluate(() => {
            document
              .querySelector('#rect')!
              .setAttributeNS('http://www.w3.org/2000/svg', 'mark', 'yes')
            const empty = document.createElementNS(null, 'item')
            empty.id = 'empty'
            document.body.append(empty)
          })
        }
        await page.addStyleTag({ content: css })
        if (css === output.sharedCss || css.startsWith('@namespace empty'))
          values.push(
            await page.evaluate(() =>
              ['html', 'rect', 'circle', 'empty', 'html-item'].map((id) => {
                const value = getComputedStyle(document.getElementById(id)!)
                return [
                  value.color,
                  value.backgroundColor,
                  value.fill,
                  value.stroke,
                ]
              }),
            ),
          )
      }
      expect(values[0]).toMatchInlineSnapshot(`
        [
          [
            "rgb(128, 0, 128)",
            "rgb(255, 255, 0)",
            "rgb(0, 0, 0)",
            "none",
          ],
          [
            "rgb(0, 0, 0)",
            "rgba(0, 0, 0, 0)",
            "rgb(255, 0, 0)",
            "rgb(0, 128, 0)",
          ],
          [
            "rgb(0, 0, 0)",
            "rgba(0, 0, 0, 0)",
            "rgb(0, 0, 255)",
            "none",
          ],
          [
            "rgb(255, 165, 0)",
            "rgb(255, 192, 203)",
            "rgb(0, 0, 0)",
            "none",
          ],
          [
            "rgb(0, 0, 0)",
            "rgb(255, 192, 203)",
            "rgb(0, 0, 0)",
            "none",
          ],
        ]
      `)
      expect(values[1]).toMatchInlineSnapshot(`
        [
          [
            "rgb(128, 0, 128)",
            "rgb(255, 255, 0)",
            "rgb(0, 0, 0)",
            "none",
          ],
          [
            "rgb(0, 0, 0)",
            "rgba(0, 0, 0, 0)",
            "rgb(255, 0, 0)",
            "rgb(0, 128, 0)",
          ],
          [
            "rgb(0, 0, 0)",
            "rgba(0, 0, 0, 0)",
            "rgb(0, 0, 255)",
            "none",
          ],
          [
            "rgb(255, 165, 0)",
            "rgb(255, 192, 203)",
            "rgb(0, 0, 0)",
            "none",
          ],
          [
            "rgb(0, 0, 0)",
            "rgb(255, 192, 203)",
            "rgb(0, 0, 0)",
            "none",
          ],
        ]
      `)
    } finally {
      await browser.close()
    }
  })
})
