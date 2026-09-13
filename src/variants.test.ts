/** Exercises public recipe compilation and real browser choice transitions. @module */
import * as Esbuild from 'esbuild'
import * as Lightning from 'lightningcss'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Source, Transform } from 'zyzz/compiler'

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
  test('renders registered computed conditions in recipe bodies', async () => {
    const source = `import {variants} from 'zyzz';import {customMedia} from 'zyzz/web';const query=customMedia('(width > 0px)');export const button=variants({base:{[query]:{color:'red'}},variants:{size:{sm:{[query]:{padding:'4px'}}}},defaultVariants:{size:'sm'},compoundVariants:[{when:{size:'sm'},style:{[query]:{opacity:0.5}}}]});`
    const graph = Graph.compile({ modules: { 'computed.ts': source } })
    const output = graph.modules['computed.ts']!
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
      const css = Lightning.transform({
        filename: 'computed.css',
        code: Buffer.from((graph.sharedCss ?? '') + output.css),
        drafts: { customMedia: true },
        include: Lightning.Features.CustomMediaQueries,
        targets: { chrome: 120 << 16 },
      }).code.toString()
      await page.setContent(`<style>${css}</style><button></button>`)
      await page.addScriptTag({ content: bundled.outputFiles![0]!.text })
      await page.evaluate(
        `{const el=document.querySelector('button');for(const [key,value] of Object.entries(App.button()))key==='className'?el.className=value:el.setAttribute(key,value)}`,
      )
      expect(
        await page
          .locator('button')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot('"rgb(255, 0, 0)"')
      expect(
        await page
          .locator('button')
          .evaluate((element) => getComputedStyle(element).paddingTop),
      ).toMatchInlineSnapshot('"4px"')
      expect(
        await page
          .locator('button')
          .evaluate((element) => getComputedStyle(element).opacity),
      ).toMatchInlineSnapshot('"0.5"')
    } finally {
      await browser.close()
    }
  })

  test('keeps repeated compound selector growth proportional to rule count', () => {
    function size(count: number) {
      return Transform.compile({
        moduleId: 'compounds.ts',
        source: `import {variants} from 'zyzz';export const recipe=variants({variants:{tone:{red:{}}},compoundVariants:[${Array.from({ length: count }, (_, index) => `{when:{tone:'red'},style:{zIndex:${index}}}`).join(',')}]});`,
      }).css.length
    }
    expect(size(100) < size(50) * 2.2).toMatchInlineSnapshot('true')
  })

  test('preserves own selections, static defaults, and mixed namespace folding', async () => {
    const result = Transform.compile({
      moduleId: 'edge.ts',
      source: `import { css, variants } from 'zyzz';
      namespace styles {
        export const card = css({ color: 'red' });
        export const button = variants({ variants: { constructor: { small: {} } }, defaultVariants: { constructor: 'small' } });
      }
      export const props = styles.card();
      export function recipe(input?: object) { return styles.button(input) };
      export const empty = variants({ variants: { size: { sm: {} } }, defaultVariants: { size: undefined } });`,
    })
    expect(
      result.code.includes('styles.card?{className:'),
    ).toMatchInlineSnapshot(`true`)
    const output = await Esbuild.build({
      stdin: { contents: result.code, loader: 'ts', resolveDir: process.cwd() },
      alias: { 'zyzz/runtime': `${process.cwd()}/src/runtime/index.ts` },
      bundle: true,
      format: 'cjs',
      write: false,
    })
    const module = {
      exports: {} as {
        recipe: (input?: object) => Record<string, unknown>
        empty: () => Record<string, unknown>
      },
    }
    new Function('module', 'exports', output.outputFiles![0]!.text)(
      module,
      module.exports,
    )
    expect(module.exports.recipe()['data-constructor']).toMatchInlineSnapshot(
      '"small"',
    )
    expect(
      module.exports.recipe(Object.create({ constructor: 'other' }))[
        'data-constructor'
      ],
    ).toMatchInlineSnapshot('"small"')
    expect(module.exports.empty()['data-size']).toMatchInlineSnapshot(
      'undefined',
    )
  })

  test('rejects unsupported recipe keys and top-level callbacks', () => {
    expect(() =>
      Source.extract({
        moduleId: 'invalid.ts',
        source: `import { variants } from 'zyzz'; variants({ variants: { size: { 1: {} } } })`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:64: Recipe choice names require CSS-safe strings.]`,
    )
    expect(() =>
      Source.extract({
        moduleId: 'invalid.ts',
        source: `import { variants } from 'zyzz'; variants({ variants: { size: { '\\0': {} } } })`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:64: Recipe choice names require CSS-safe strings.]`,
    )
    expect(() =>
      Source.extract({
        moduleId: 'invalid.ts',
        source: `import { variants } from 'zyzz'; variants((values: { opacity: number }) => ({ base: { opacity: values.opacity } }))`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:42: Recipes require static top-level objects.]`,
    )
  })

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
      await page.evaluate(`{
        const el = document.querySelector('#button');
        window.apply = (input) => {
          const props = App.styles.button(input);
          for (const attr of [...el.attributes]) if (attr.name !== 'id') el.removeAttribute(attr.name);
          el.className = props.className;
          for (const [key, value] of Object.entries(props)) if (key.startsWith('data-')) el.setAttribute(key, value);
          Object.assign(el.style, props.style);
        };
        window.initialClass = App.styles.button().className;
        window.initialRules = document.styleSheets[0].cssRules.length;
        apply();
      }`)
      expect(
        await page.evaluate(
          `getComputedStyle(document.querySelector('#button')).paddingTop`,
        ),
      ).toMatchInlineSnapshot('"4px"')
      expect(
        await page.evaluate(
          `getComputedStyle(document.querySelector('#button')).color`,
        ),
      ).toMatchInlineSnapshot('"rgb(0, 0, 0)"')
      expect(
        await page.evaluate(
          `getComputedStyle(document.querySelector('#button')).opacity`,
        ),
      ).toMatchInlineSnapshot('"1"')
      expect(
        await page.evaluate(
          `getComputedStyle(document.querySelector('#button')).fontWeight`,
        ),
      ).toMatchInlineSnapshot('"400"')
      expect(
        await page.evaluate(
          `document.querySelector('#button').getAttribute('data-size')`,
        ),
      ).toMatchInlineSnapshot('"sm"')
      expect(
        await page.evaluate(
          `document.querySelector('#button').getAttribute('data-loading')`,
        ),
      ).toMatchInlineSnapshot('"false"')
      await page.evaluate(`apply({size:'lg',loading:true})`)
      expect(
        await page.evaluate(
          `getComputedStyle(document.querySelector('#button')).paddingTop`,
        ),
      ).toMatchInlineSnapshot('"12px"')
      expect(
        await page.evaluate(
          `getComputedStyle(document.querySelector('#button')).color`,
        ),
      ).toMatchInlineSnapshot('"rgb(0, 0, 255)"')
      expect(
        await page.evaluate(
          `getComputedStyle(document.querySelector('#button')).opacity`,
        ),
      ).toMatchInlineSnapshot('"0.5"')
      expect(
        await page.evaluate(
          `getComputedStyle(document.querySelector('#button')).fontWeight`,
        ),
      ).toMatchInlineSnapshot('"700"')
      expect(
        await page.evaluate(
          `document.querySelector('#button').getAttribute('data-size')`,
        ),
      ).toMatchInlineSnapshot('"lg"')
      expect(
        await page.evaluate(
          `document.querySelector('#button').getAttribute('data-loading')`,
        ),
      ).toMatchInlineSnapshot('"true"')
      await page.evaluate(
        `apply({size:null,loading:null,style:{color:'green'}})`,
      )
      expect(
        await page.evaluate(
          `getComputedStyle(document.querySelector('#button')).paddingTop`,
        ),
      ).toMatchInlineSnapshot('"2px"')
      expect(
        await page.evaluate(
          `getComputedStyle(document.querySelector('#button')).color`,
        ),
      ).toMatchInlineSnapshot('"rgb(0, 128, 0)"')
      expect(
        await page.evaluate(
          `getComputedStyle(document.querySelector('#button')).opacity`,
        ),
      ).toMatchInlineSnapshot('"1"')
      expect(
        await page.evaluate(
          `getComputedStyle(document.querySelector('#button')).fontWeight`,
        ),
      ).toMatchInlineSnapshot('"400"')
      expect(
        await page.evaluate(
          `document.querySelector('#button').getAttribute('data-size')`,
        ),
      ).toMatchInlineSnapshot('null')
      expect(
        await page.evaluate(
          `document.querySelector('#button').getAttribute('data-loading')`,
        ),
      ).toMatchInlineSnapshot('null')
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
      await page.evaluate(`apply({size:undefined,loading:false})`)
      expect(
        await page.evaluate(
          `getComputedStyle(document.querySelector('#button')).paddingTop`,
        ),
      ).toMatchInlineSnapshot('"4px"')
      expect(
        await page.evaluate(
          `getComputedStyle(document.querySelector('#button')).color`,
        ),
      ).toMatchInlineSnapshot('"rgb(0, 0, 0)"')
      expect(
        await page.evaluate(
          `getComputedStyle(document.querySelector('#button')).opacity`,
        ),
      ).toMatchInlineSnapshot('"1"')
      expect(
        await page.evaluate(
          `getComputedStyle(document.querySelector('#button')).fontWeight`,
        ),
      ).toMatchInlineSnapshot('"400"')
      expect(
        await page.evaluate(
          `document.querySelector('#button').getAttribute('data-size')`,
        ),
      ).toMatchInlineSnapshot('"sm"')
      expect(
        await page.evaluate(
          `document.querySelector('#button').getAttribute('data-loading')`,
        ),
      ).toMatchInlineSnapshot('"false"')
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
