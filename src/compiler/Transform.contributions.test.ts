/** Exercises stylesheet effects through the public source compiler. @module */
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Transform } from 'zyzz/compiler'

describe('stylesheet contributions', () => {
  test('preserves layer discovery order and omits optional font descriptors', () => {
    const output = Transform.compile({
      moduleId: 'effects.ts',
      source: `import {layers,fontFace,global} from 'zyzz/web'; layers(['reset','base']); layers(['components']); fontFace({fontFamily:'App',src:'url(/app.woff2)',fontWeight:undefined}); global({'body::before':{content:'"url(relative)"'}})`,
    })

    expect(output.css).toMatchInlineSnapshot(`
      "@layer reset,base,components;
      @font-face{font-family:App;src:url(/app.woff2);}
      body::before{content:"url(relative)";}"
    `)
  })
  test('rejects conditional classes and shadowed undefined descriptors', () => {
    for (const source of [
      `class Never { static { global({body:{color:'red'}}) } }`,
      `const unused = false ? class { static { global({body:{color:'red'}}) } } : null`,
      `const undefined = 'bold'; fontFace({fontFamily:'App',src:'url(/app.woff2)',fontWeight:undefined})`,
    ])
      expect(() =>
        Transform.compile({
          moduleId: 'bad.ts',
          source: `import {global,fontFace} from 'zyzz/web'; ${source}`,
        }),
      ).toThrow()
  })
  test('locates a malformed later contribution at its own span', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'located.ts',
        source: `import {global} from 'zyzz/web'; global({body:{color:'red'}}); global({body:{color:unknown}})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: located.ts:63: Stylesheet contributions require literal data.]`,
    )
  })

  test('Chromium applies global layers and static keyframes', async () => {
    const output = Transform.compile({
      moduleId: 'browser.ts',
      source:
        'import {global,keyframes,layers} from "zyzz/web"; layers(["reset","base"]); const fade=keyframes({from:{opacity:0},to:{opacity:1}}); global({"@layer reset":{body:{margin:"20px"}},"@layer base":{body:{margin:0}},body:{animationName:fade,animationDuration:"1s",animationTimingFunction:"linear",animationDelay:"-0.5s",animationPlayState:"paused"}})',
    })

    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()

      await page.setContent('<body>Animation</body>')
      await page.addStyleTag({ content: output.css })

      expect(
        await page.evaluate(() => getComputedStyle(document.body).margin),
      ).toMatchInlineSnapshot(`"0px"`)
      expect(
        await page.evaluate(() => getComputedStyle(document.body).opacity),
      ).toMatchInlineSnapshot(`"0.5"`)
    } finally {
      await browser.close()
    }
  })
  test('extracts global rules, fonts, layers and live animation names', () => {
    const result = Transform.compile({
      moduleId: 'app/styles.ts',
      source:
        'import {css} from "zyzz"; import {global,fontFace,keyframes,layers} from "zyzz/web"; layers(["reset","base"]); global({"@layer reset":{"body":{margin:0}},"body":{color:"red"}}); fontFace({fontFamily:"App",src:"url(/font.woff2)",fontDisplay:"swap"}); const unused=keyframes({from:{opacity:0},to:{opacity:1}}); const fade=keyframes({from:{opacity:0},to:{opacity:1}}); export const box=css({animationName:fade})()',
    })

    expect(result.css).toMatchInlineSnapshot(`
      "@layer reset,base;
      @layer reset{body{margin:0;}}
      body{color:red;}
      @font-face{font-family:App;src:url(/font.woff2);font-display:swap;}
      @keyframes z-k11238c6bg65w8-66-61-64-65{from{opacity:0;}to{opacity:1;}}
      .z-11238c6bg65w8-base0{animation-name:z-k11238c6bg65w8-66-61-64-65;}"
    `)
    expect(result.code).toMatchInlineSnapshot(
      `"  void 0; void 0; void 0; const unused="z-k11238c6bg65w8-75-6e-75-73-65-64"; const fade="z-k11238c6bg65w8-66-61-64-65"; export const box=({className:"z-11238c6bg65w8-base0"})"`,
    )
  })
  test('keeps theme references live in global rules', () => {
    expect(
      Transform.compile({
        moduleId: 'app.ts',
        source:
          'import {Theme} from "zyzz"; import {global} from "zyzz/web"; const theme=Theme.define({color:{ink:"red"}}); global({body:{color:theme.tokens.color.ink}})',
      }).css,
    ).toMatchInlineSnapshot(`
      "body{color:var(--z-t1e8a67z1uaws1j-theme-color_2e_ink,red);}
      .z_theme-1e8a67z1uaws1j-theme{--z-t1e8a67z1uaws1j-theme-color_2e_ink:red;}"
    `)
  })
  test('rejects invalid contributions', () => {
    const failures = [
      'if(true) global({body:{color:"red"}})',
      'global({"[":{color:"red"}})',
      'layers(["one","two"]); layers(["two","one"])',
      'const frames=keyframes({"101%":{opacity:0}})',
    ].map((source) => {
      try {
        Transform.compile({
          moduleId: 'bad.ts',
          source: 'import {global,layers,keyframes} from "zyzz/web";' + source,
        })

        return 'accepted'
      } catch (error) {
        return (error as Error).message
      }
    })

    expect(failures).toMatchInlineSnapshot(`
      [
        "bad.ts:58: Stylesheet contributions require direct module-level calls and constant animation bindings.",
        "bad.ts:49: Unexpected end of input",
        "bad.ts:49: ["contributions"]: Conflicting layer order constraints.",
        "bad.ts:62: Keyframe stops must be from, to, or percentages from 0 to 100.",
      ]
    `)
  })
  test('collects unimported effects once and replaces the snapshot on deletion', () => {
    const compiler = Graph.create()

    const modules = {
      'app.ts':
        'import {css} from "zyzz"; export const box=css({color:"blue"})()',
      'global.ts':
        'import {global,layers} from "zyzz/web"; layers(["reset","app"]); global({body:{margin:0}})',
    }

    const first = compiler.compile({ modules })

    expect({
      shared: first.sharedCss,
      modules: Object.values(first.modules).map((value) => value.css),
    }).toMatchInlineSnapshot(`
      {
        "modules": [
          ".z-1e8a67z1uaws1j-base0{color:blue;}",
          "",
        ],
        "shared": "@layer reset,app;
      body{margin:0;}",
      }
    `)
    expect(
      compiler.compile({ modules: { 'app.ts': modules['app.ts'] } }).sharedCss,
    ).toMatchInlineSnapshot(`undefined`)
  })
})
