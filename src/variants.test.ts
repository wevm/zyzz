/** Exercises public recipe compilation and real browser choice transitions. @module */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Source } from 'zyzz/compiler'

const source = `import { variants as recipe } from 'zyzz'
export namespace styles {
  export const button = recipe({
    base: { color: 'black', padding: '2px', opacity: 1 },
    variants: {
      size: { sm: { padding: '4px' }, lg: { padding: '12px' } },
      loading: { true: { opacity: 0.5 }, false: { opacity: 1 } },
    },
    defaultVariants: { size: 'sm', loading: false },
    compoundVariants: [
      { when: { size: ['sm', 'lg'], loading: true }, style: { color: 'red' } },
      { when: { size: 'lg', loading: true }, style: { color: 'blue' } },
      { when: { size: 'lg', loading: true }, style: { fontWeight: 700 } },
    ],
  })
}`

describe('variants', () => {
  test('renders defaults, choices, ordered compounds, null, and inline overrides', async () => {
    const result = Graph.compile({ modules: { 'recipe.ts': source } })
    const output = result.modules['recipe.ts']!
    const bundled = await Esbuild.build({
      stdin: { contents: output.code, loader: 'ts', resolveDir: process.cwd() },
      alias: { 'zyzz/runtime': `${process.cwd()}/src/runtime/index.ts` },
      bundle: true,
      format: 'iife',
      globalName: 'App',
      write: false,
    })
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox'],
    })

    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>${output.css}</style><button id="button">Button</button>`,
      )
      await page.addScriptTag({ content: bundled.outputFiles![0]!.text })
      const initial = await page.evaluate(`{
        const el = document.querySelector('#button');
        window.apply = (input) => {
          const props = App.styles.button(input);
          for (const attr of [...el.attributes]) if (attr.name !== 'id') el.removeAttribute(attr.name);
          el.className = props.className;
          for (const [key, value] of Object.entries(props)) if (key.startsWith('data-')) el.setAttribute(key, value);
          Object.assign(el.style, props.style);
          const computed = getComputedStyle(el);
          return [computed.paddingTop, computed.color, computed.opacity, computed.fontWeight, el.getAttribute('data-size'), el.getAttribute('data-loading')];
        };
        window.initialClass = App.styles.button().className;
        window.initialRules = document.styleSheets[0].cssRules.length;
        apply();
      }`)
      expect(initial).toMatchInlineSnapshot(`
        [
          "4px",
          "rgb(0, 0, 0)",
          "1",
          "400",
          "sm",
          "false",
        ]
      `)
      expect(await page.evaluate(`apply({size:'lg',loading:true})`))
        .toMatchInlineSnapshot(`
        [
          "12px",
          "rgb(0, 0, 255)",
          "0.5",
          "700",
          "lg",
          "true",
        ]
      `)
      expect(
        await page.evaluate(
          `apply({size:null,loading:null,style:{color:'green'}})`,
        ),
      ).toMatchInlineSnapshot(`
        [
          "2px",
          "rgb(0, 128, 0)",
          "1",
          "400",
          null,
          null,
        ]
      `)
      expect(
        await page.evaluate(
          `App.styles.button({size:'lg'}).className === initialClass`,
        ),
      ).toMatchInlineSnapshot('true')
      expect(
        await page.evaluate(
          `document.styleSheets[0].cssRules.length === initialRules`,
        ),
      ).toMatchInlineSnapshot('true')
      expect(await page.evaluate(`apply({size:undefined,loading:false})`))
        .toMatchInlineSnapshot(`
        [
          "4px",
          "rgb(0, 0, 0)",
          "1",
          "400",
          "sm",
          "false",
        ]
      `)
    } finally {
      await browser.close()
    }
  })

  test('reports unsupported recipe structure at its source', () => {
    expect(() =>
      Source.extract({
        moduleId: 'recipe.ts',
        source: `import {variants} from 'zyzz'; variants({slots:{root:{}}})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: recipe.ts:41: Unknown recipe field: slots.]`,
    )
    expect(() =>
      Source.extract({
        moduleId: 'recipe.ts',
        source: `import {variants} from 'zyzz'; variants({variants:{size:{sm:{}}},defaultVariants:{size:'lg'}})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: recipe.ts:87: Unknown recipe choice.]`,
    )
  })
})
