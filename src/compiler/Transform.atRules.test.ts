/** Verifies at-rule authoring through source extraction, CSS emission, and native rendering. @module */
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import { Css } from 'zyzz/web'

describe('compile', () => {
  test('preserves grouped font descriptors and timeline range stops', () => {
    const output = Transform.compile({
      moduleId: 'rules.ts',
      source: `import { fontFace, keyframes } from 'zyzz/web';
fontFace({fontFamily:'Body',src:'local("Arial")',fontFeatureSettings:'"kern"',fontVariationSettings:'"wght" 400'}, {within:['@layer fonts','@media screen']});
export const fade = keyframes({'entry 0%, cover 10%':{opacity:0},'exit 100%':{opacity:1}}, {within:['@supports (display: grid)']});`,
    })
    expect(output.css).toMatchInlineSnapshot(`
      "@layer fonts{@media screen{@font-face{font-family:Body;src:local("Arial");font-feature-settings:"kern";font-variation-settings:"wght" 400;}}}
      @supports (display: grid){@keyframes z-ko6ez0r19fmsab-66-61-64-65{entry 0%, cover 10%{opacity:0;}exit 100%{opacity:1;}}}"
    `)
    expect(output.code).toMatchInlineSnapshot(`
      "
      void 0;
      export const fade = "z-ko6ez0r19fmsab-66-61-64-65";"
    `)
  })
  test('resolves configured queries across CSS whitespace and comment boundaries', () => {
    const output = Transform.compile({
      moduleId: 'queries.ts',
      source: `import {Theme} from 'zyzz';const theme=Theme.define({breakpoints:{tablet:'48rem'}});export const styles={card:theme.css({'@media\\ttablet':{color:'red'},'@media/**/tablet':{color:'blue'}})};`,
    })
    expect(output.css).toMatchInlineSnapshot(`".z-style-1df82zi1f2cka-110{@media (width >= 48rem){color:red;}@media (width >= 48rem){color:blue;}}"`)
  })
  test('keeps scope, layer, and scroll-state nesting in authored order', () => {
    const output = Transform.compile({
      moduleId: 'scope.ts',
      source: `import {css} from 'zyzz'; export const styles = {box:css({'@scope (.outer) to (.stop)':{'@layer components':{color:'red','@container scroll-state(stuck: top)':{color:'blue'}}}})}`,
    })
    expect(output.css).toMatchInlineSnapshot(
      `".z-style-mond465apgew-53{@scope (.outer) to (.stop){@layer components{color:red;@container scroll-state(stuck: top){color:blue;}}}}"`,
    )
  })
  test('defaults undefined contexts and accepts anonymous and CSS-whitespace groups', () => {
    const output = Transform.compile({
      moduleId: 'contexts.ts',
      source: `import {fontFace,keyframes,global} from 'zyzz/web';fontFace({fontFamily:'Body',src:'url(/body)'},undefined);export const fade=keyframes({from:{opacity:0},to:{opacity:1}},void 1);fontFace({fontFamily:'Layered',src:'url(/body)'},{within:['@layer']});global({'@media\\nscreen':{body:{color:'red'}},'@supports(display:grid)':{body:{display:'grid'}},'@media/**/print':{body:{color:'blue'}}});`,
    })
    expect(output.css).toMatchInlineSnapshot(`
      "@font-face{font-family:Body;src:url(/body);}
      @keyframes z-k4rx34s72jf3i-66-61-64-65{from{opacity:0;}to{opacity:1;}}
      @layer{@font-face{font-family:Layered;src:url(/body);}}
      @media
      screen{body{color:red;}}
      @supports(display:grid){body{display:grid;}}
      @media/**/print{body{color:blue;}}"
    `)
  })
  test('Chromium applies local scope and layer rules as a scroll-state query changes', async () => {
    const output = Transform.compile({
      moduleId: 'nested.ts',
      source: `import {css} from 'zyzz';export const styles={item:css({'@scope (&) to (.stop)':{'@layer components':{'& .item':{color:'red','@container scroll-state(stuck: top)':{color:'blue'}}}}})};`,
    })
    const name = Object.values(output.classes)[0]!
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<div class="outer ${name}" style="height:80px;overflow:auto"><div style="container-type:scroll-state;position:sticky;top:0"><span id="inside" class="item">inside</span><div class="stop"><span id="outside" class="item">outside</span></div></div><div style="height:300px"></div></div>`,
      )
      await page.addStyleTag({ content: output.css })
      expect(
        await page
          .locator('#inside')
          .evaluate((el) => getComputedStyle(el).color),
      ).toMatchInlineSnapshot('"rgb(255, 0, 0)"')
      await page.locator('.outer').evaluate((el) => {
        el.scrollTop = 40
      })
      await page.waitForFunction(
        () =>
          getComputedStyle(document.querySelector('#inside')!).color ===
          'rgb(0, 0, 255)',
      )
      expect(
        await page
          .locator('#inside')
          .evaluate((el) => getComputedStyle(el).color),
      ).toMatchInlineSnapshot('"rgb(0, 0, 255)"')
      expect(
        await page
          .locator('#outside')
          .evaluate((el) => getComputedStyle(el).color),
      ).toMatchInlineSnapshot('"rgb(0, 0, 0)"')
    } finally {
      await browser.close()
    }
  })
  test('keeps layer order top-level without empty conditional wrappers', () => {
    expect(
      Css.compile({
        styles: { styles: [] },
        contributions: [
          { kind: 'layers', names: ['base'], within: ['@media screen'] },
        ],
      }).css,
    ).toMatchInlineSnapshot('"@layer base;"')
  })
  test('Chromium applies scope boundaries', async () => {
    const output = Transform.compile({
      moduleId: 'scope.ts',
      source: `import {global} from 'zyzz/web'; global({'@scope (.outer) to (.stop)':{p:{color:'red'}}})`,
    })
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent(
        '<div class="outer"><p id="inside">Inside</p><div class="stop"><p id="outside">Outside</p></div></div>',
      )
      await page.addStyleTag({ content: output.css })
      expect(
        await page
          .locator('#inside')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot('"rgb(255, 0, 0)"')
      expect(
        await page
          .locator('#outside')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot('"rgb(0, 0, 0)"')
    } finally {
      await browser.close()
    }
  })
})
