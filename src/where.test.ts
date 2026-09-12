/** Exercises selector references through compilation, distribution, and browser rendering. @module */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Source } from 'zyzz/compiler'

const source = `import { css, where } from 'zyzz'
export namespace styles {
  export const card = css({ padding: '16px' })
  export const empty = css({})
  export const label = css({
    color: 'black',
    [where\`\${card}:hover &\`]: { color: 'blue' },
    [where\`\${card} > &:nth-child(even)\`]: { opacity: 0.5 },
    [where\`\${empty} + &\`]: { fontWeight: 700 },
  })
}
export const outside = css({ [where\`\${styles.card} > &\`]: { margin: 0 } })`

describe('where', () => {
  test('compiles namespace definitions and scoped selectors', () => {
    const result = Graph.compile({ modules: { 'app.ts': source } })
    expect(result.modules['app.ts']!.css).toMatchInlineSnapshot(`
      ".z-style-1e8a67z1uaws1j-82{padding:16px;}
      .z-style-1e8a67z1uaws1j-161{color:black;.z-style-1e8a67z1uaws1j-82:hover &{color:blue;}.z-style-1e8a67z1uaws1j-82 > &:nth-child(even){opacity:0.5;}.z-style-1e8a67z1uaws1j-130 + &{font-weight:700;}}
      .z-style-1e8a67z1uaws1j-374{.z-style-1e8a67z1uaws1j-82 > &{margin:0;}}"
    `)
    expect(result.modules['app.ts']!.code).toMatchInlineSnapshot(`
      "
      import { Props as __zyzzProps } from 'zyzz/runtime';

      export namespace styles {
        export const card = __zyzzProps.create({className:"z-style-1e8a67z1uaws1j-82"})
        export const empty = __zyzzProps.create({className:"z-style-1e8a67z1uaws1j-130"})
        export const label = __zyzzProps.create({className:"z-style-1e8a67z1uaws1j-161"})
      }
      export const outside = __zyzzProps.create({className:"z-style-1e8a67z1uaws1j-374"})"
    `)
  })

  test('resolves aliases and named re-exports across source and packed modules', () => {
    const publisher = Graph.compile({
      modules: {
        'library.ts': `import { css } from 'zyzz'; export const card = css({}); export namespace styles { export const button = css({color:'red'}) }`,
        'barrel.ts': `import { card, styles } from './library.js'; export { card as panel, styles }`,
      },
    })
    const app = `import { css, where as when } from 'zyzz'; import { panel, styles } from './barrel.js'; const alias = panel; export const label = css({ [when\`\${alias} > &, \${styles.button} + &\`]: {color:'blue'} })`
    const result = Graph.compile({
      modules: { 'app.ts': app },
      contracts: publisher.contracts,
      imports: { 'app.ts': { zyzz: null, './barrel.js': 'barrel.ts' } },
    })
    expect(result.modules['app.ts']!.css).toMatchInlineSnapshot(
      `".z-style-1e8a67z1uaws1j-130{.z-style-ggnaaj17b3mnh-48 > &, .z-style-ggnaaj17b3mnh-105 + &{color:blue;}}"`,
    )
    expect(
      JSON.parse(publisher.contracts['barrel.ts']!).version,
    ).toMatchInlineSnapshot('13')
  })

  test('rejects unresolved, called, forward, and unscoped references', () => {
    expect(() =>
      Source.extract({
        moduleId: 'invalid.ts',
        source:
          "import {css,where} from 'zyzz'; css({[where`${missing} &`]:{color:'red'}})",
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:46: where interpolations require previously declared css definitions.]`,
    )
    expect(() =>
      Source.extract({
        moduleId: 'called.ts',
        source:
          "import {css,where} from 'zyzz'; const card=css({}); css({[where`${card()} &`]:{color:'red'}})",
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: called.ts:66: where interpolations require css definitions without calling them.]`,
    )
    expect(() =>
      Source.extract({
        moduleId: 'forward.ts',
        source: `import {css,where} from 'zyzz'; css({[where\`\${card} &\`]:{color:'red'}}); const card=css({})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: forward.ts:46: where interpolations require previously declared css definitions.]`,
    )
    expect(() =>
      Source.extract({
        moduleId: 'scope.ts',
        source: `import {css,where} from 'zyzz'; const card=css({}); css({[where\`\${card}:hover\`]:{color:'red'}})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: scope.ts:58: where selectors require an explicit & target.]`,
    )
  })

  test('keeps lexical aliases and deduplicated definitions distinct', () => {
    const result = Graph.compile({
      modules: {
        'scoped.ts': `import {css,where} from 'zyzz';
const card=css({color:'red'}); const alias=card;
const other=css({color:'red'});
function nested(){ const card=other; return css({[where\`\${alias}:hover &\`]:{color:'blue'}}) }
export {card,other,nested};`,
      },
    })
    expect(result.modules['scoped.ts']!.code).toMatchInlineSnapshot(`
      "
      import { Props as __zyzzProps } from 'zyzz/runtime';

      const card=__zyzzProps.create({className:"z-style-1kmi93w1julwr4-43"}); const alias=card;
      const other=__zyzzProps.create({className:"z-style-1kmi93w1julwr4-93"});
      function nested(){ const card=other; return __zyzzProps.create({className:"z-style-1kmi93w1julwr4-157"}) }
      export {card,other,nested};"
    `)
    expect(result.modules['scoped.ts']!.css).toMatchInlineSnapshot(`
      ".z-style-1kmi93w1julwr4-43{color:red;}
      .z-style-1kmi93w1julwr4-93{color:red;}
      .z-style-1kmi93w1julwr4-157{.z-style-1kmi93w1julwr4-43:hover &{color:blue;}}"
    `)
  })

  test('binds dynamic ancestor conditions and rejects descendant slot targets', () => {
    const result = Graph.compile({
      modules: {
        'dynamic.ts': `import {css,where} from 'zyzz';
const card=css({}); export const label=css((values:{opacity:number})=>({[where\`\${card}:hover &\`]:{opacity:values.opacity}}));`,
      },
    })
    expect(result.modules['dynamic.ts']!.code).toMatchInlineSnapshot(`
      "
      import { Props as __zyzzProps } from 'zyzz/runtime';

      const card=__zyzzProps.create({className:"z-style-1h5dayl7tfv4v-43"}); export const label=(((input:Parameters<import('zyzz').css.Dynamic<{opacity:number}>>[0])=>{const v0=input["opacity"];const external=input.className;const style=input.style;return {className:external?"z-style-1h5dayl7tfv4v-71"+" "+external:"z-style-1h5dayl7tfv4v-71",style:{...style,"--z-d1h5dayl7tfv4v-71-6f-70-61-63-69-74-79":v0===''?' ':v0}}}) as import('zyzz').css.Dynamic<{opacity:number}>);"
    `)
    expect(() =>
      Source.extract({
        moduleId: 'descendant.ts',
        source:
          "import {css,where} from 'zyzz'; css((values:{opacity:number})=>({[where`& > span`]:{opacity:values.opacity}}))",
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Source.ExtractError: descendant.ts:66: where templates require a compiled style definition.
      descendant.ts:92: Dynamic values require conditions that select the styled element.
      descendant.ts:92: Expected a literal string or number; expressions are not evaluated.]
    `)
  })

  test('rejects unscoped lists, malformed selectors, and standalone templates', () => {
    expect(() =>
      Source.extract({
        moduleId: 'list.ts',
        source:
          "import {css,where} from 'zyzz'; css({[where`&:hover, body`]:{color:'red'}})",
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: list.ts:38: Selector lists require explicit & selectors.]`,
    )
    expect(() =>
      Source.extract({
        moduleId: 'syntax.ts',
        source:
          "import {css,where} from 'zyzz'; css({[where`& > > span`]:{color:'red'}})",
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: syntax.ts:38: Invalid dangling combinator in selector]`,
    )
    expect(() =>
      Source.extract({
        moduleId: 'standalone.ts',
        source: "import {where} from 'zyzz'; const condition=where`&:hover`",
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: standalone.ts:44: where templates must be computed style keys.]`,
    )
  })

  test('renders hover, nth-child, and empty style relationships', async () => {
    const result = Graph.compile({ modules: { 'app.ts': source } })
    const built = await Esbuild.transform(result.modules['app.ts']!.code, {
      format: 'esm',
      loader: 'ts',
    })
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox'],
    })
    try {
      const page = await browser.newPage()
      // Bundle the actual public runtime alongside the transformed consumer module.
      const bundled = await Esbuild.build({
        stdin: {
          contents: built.code,
          resolveDir: process.cwd(),
          sourcefile: 'app.js',
        },
        alias: { 'zyzz/runtime': `${process.cwd()}/src/runtime/index.ts` },
        bundle: true,
        format: 'iife',
        globalName: 'App',
        write: false,
      })
      await page.setContent(
        `<style>${result.modules['app.ts']!.css}</style><div id="root"></div>`,
      )
      await page.addScriptTag({ content: bundled.outputFiles![0]!.text })
      await page.evaluate(`{
        const {styles} = App;
        document.querySelector('#root').innerHTML = '<div id="card" class="'+styles.card().className+'"><span class="'+styles.empty().className+'"></span><span id="label" class="'+styles.label().className+'">Label</span></div>';
      }`)
      expect(
        await page
          .locator('#label')
          .evaluate((node) => getComputedStyle(node).opacity),
      ).toMatchInlineSnapshot('"0.5"')
      expect(
        await page
          .locator('#label')
          .evaluate((node) => getComputedStyle(node).fontWeight),
      ).toMatchInlineSnapshot('"700"')
      await page.locator('#card').hover()
      expect(
        await page
          .locator('#label')
          .evaluate((node) => getComputedStyle(node).color),
      ).toMatchInlineSnapshot('"rgb(0, 0, 255)"')
    } finally {
      await browser.close()
    }
  })
})
