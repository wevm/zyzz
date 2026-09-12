/** Measures native font, counter, animation, anchor, and namespace behavior from compiled CSS. @module */
import * as Fs from 'node:fs/promises'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Transform } from 'zyzz/compiler'
import * as Font from '../../test/fixtures/AtRuleFont.js'

describe('compile', () => {
  test('Chromium loads a real font and applies counters, keyframes, namespace boundaries, and position fallbacks', async () => {
    const output = Graph.compile({
      modules: {
        'rules.ts': `import {css} from 'zyzz';import {fontFace,counterStyle,keyframes,positionTry,global,page} from 'zyzz/web';
fontFace({fontFamily:'Evidence',src:${JSON.stringify(`url("${Font.url}")`)},fontDisplay:'block'});
export const dots=counterStyle({system:'cyclic',symbols:'"●"',suffix:'" "'});
export const fade=keyframes({from:{opacity:0},to:{opacity:1}});
export const above=positionTry({positionArea:'top'});
global({'html':{height:'100%',overflow:'hidden'},'body':{margin:0,height:'100%',overflow:'hidden'},'#font':{fontFamily:'Evidence',fontSize:'100px',display:'inline-block'},'#animation':{animationName:fade,animationDuration:'1s',animationDelay:'-0.5s',animationPlayState:'paused',animationTimingFunction:'linear'},'#anchor':{anchorName:'--target',position:'absolute',top:'180px',left:'100px',width:'20px',height:'10px'},'#tooltip':{position:'absolute',positionAnchor:'--target',positionArea:'bottom',positionTryFallbacks:above,width:'50px',height:'30px'},'.counter':{listStyleType:dots,listStylePosition:'inside',width:'100px',height:'24px',fontFamily:'Arial',fontSize:'16px'}});
page({descriptors:{size:'A4','@top-center':{content:'"Page"'}}});`,
        'svg.ts': `import {namespace,global} from 'zyzz/web';namespace({uri:'http://www.w3.org/2000/svg'});global({'.icon':{fill:'red'}});`,
      },
    })
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    const browser = await chromium.launch(
      executablePath ? { executablePath } : {},
    )
    try {
      const page = await browser.newPage({
        viewport: { width: 300, height: 200 },
      })
      await page.setContent(
        '<span id="font">A</span><div id="animation">fade</div><div id="anchor"></div><div id="tooltip"></div><svg><rect id="svg" class="icon"/></svg><rect id="html" class="icon"></rect><li id="compiled" class="counter">item</li><li id="native" class="counter">item</li>',
      )
      await page.addStyleTag({ content: output.sharedCss! })
      await page.addStyleTag({
        content:
          '@counter-style reference {system:cyclic;symbols:"●";suffix:" "} #native {list-style-type:reference} ',
      })
      await page.evaluate(() => document.fonts.ready)
      expect(
        await page.evaluate(() => document.fonts.check('100px Evidence')),
      ).toMatchInlineSnapshot('true')
      expect(
        await page
          .locator('#font')
          .evaluate((element) => element.getBoundingClientRect().width),
      ).toMatchInlineSnapshot('60')
      expect(
        await page
          .locator('#animation')
          .evaluate((element) => getComputedStyle(element).opacity),
      ).toMatchInlineSnapshot('"0.5"')
      expect(
        await page
          .locator('#svg')
          .evaluate((element) => getComputedStyle(element).fill),
      ).toMatchInlineSnapshot('"rgb(255, 0, 0)"')
      expect(
        await page
          .locator('#html')
          .evaluate((element) => getComputedStyle(element).fill),
      ).toMatchInlineSnapshot('"rgb(0, 0, 0)"')
      expect(
        await page.locator('#tooltip').evaluate((element) => {
          const box = element.getBoundingClientRect()
          return {
            bottom: box.bottom,
            height: box.height,
            left: box.left,
            width: box.width,
          }
        }),
      ).toMatchInlineSnapshot(`
        {
          "bottom": 180,
          "height": 30,
          "left": 85,
          "width": 50,
        }
      `)
      expect(
        Buffer.compare(
          await page.locator('#compiled').screenshot(),
          await page.locator('#native').screenshot(),
        ) === 0,
      ).toMatchInlineSnapshot('true')
    } finally {
      await browser.close()
    }
  })
  test('Chromium reports experimental and legacy rule availability separately from emitted CSS', async () => {
    const cases = {
      colorProfile: `import {colorProfile} from 'zyzz/web';export const profile=colorProfile({src:'url(/profile.icc)'});`,
      customMedia: `import {customMedia} from 'zyzz/web';export const query=customMedia('(width > 1px)');`,
      cssFunction: `import {cssFunction,global} from 'zyzz/web';export const twice=cssFunction({parameters:[{name:'--x',syntax:'<length>'}],returns:'<length>',body:{result:'calc(var(--x) * 2)'}});global({'#target':{width:twice('2px')}});`,
      document: `import {global} from 'zyzz/web';global({'@document url-prefix("https://example.com/")':{body:{color:'red'}}});`,
      fontFeatureValues: `import {fontFeatureValues} from 'zyzz/web';fontFeatureValues({families:'Evidence',fontDisplay:'swap',features:{'@styleset':{editorial:[1,2]}}});`,
      viewTransition: `import {viewTransition} from 'zyzz/web';viewTransition({navigation:'auto',types:'slide'});`,
    }
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    const browser = await chromium.launch(
      executablePath ? { executablePath } : {},
    )
    try {
      const page = await browser.newPage()
      const capabilities: Record<
        string,
        {
          accepted: boolean
          cssom: readonly string[]
          rendering?: 'unavailable' | 'unverified' | 'verified'
        }
      > = {}
      for (const [name, source] of Object.entries(cases)) {
        const output = Transform.compile({ moduleId: `${name}.ts`, source })
        const rules = await page.evaluate((css) => {
          const sheet = new CSSStyleSheet()
          sheet.replaceSync(css)
          return [...sheet.cssRules].map((rule) => rule.cssText)
        }, output.css)
        capabilities[name] = {
          accepted: rules.some((rule) => rule.startsWith('@')),
          cssom: rules,
        }
        if (name === 'colorProfile')
          capabilities[name].rendering = capabilities[name].accepted
            ? 'unverified'
            : 'unavailable'
        await Fs.mkdir('test-results', { recursive: true })
        await Fs.writeFile(
          'test-results/at-rule-browser-capabilities.json',
          JSON.stringify({ browser: browser.version(), capabilities }, null, 2),
        )
        if (name === 'cssFunction' && capabilities[name].accepted) {
          await page.setContent('<div id="target"></div>')
          await page.addStyleTag({ content: output.css })
          expect(
            await page
              .locator('#target')
              .evaluate((element) => getComputedStyle(element).width),
          ).toMatchInlineSnapshot('"4px"')
        }
      }
      expect(Object.keys(capabilities)).toMatchInlineSnapshot(`
        [
          "colorProfile",
          "customMedia",
          "cssFunction",
          "document",
          "fontFeatureValues",
          "viewTransition",
        ]
      `)
    } finally {
      await browser.close()
    }
  })
})
