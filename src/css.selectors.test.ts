/** Exercises selector references through compilation, distribution, and browser rendering. @module */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Source } from 'zyzz/compiler'

const source = `import {css} from 'zyzz';
export namespace styles {
  export const card = css({ padding: '16px' })
  export const empty = css()
  export const label = css({color: 'black',selectors:{[\`\${card}:hover &\`]:{ color: 'blue' },[\`\${card} > &:nth-child(even)\`]:{ opacity: 0.5 },[\`\${empty} + &\`]:{ fontWeight: 700 }}})
}
export const outside = css({selectors:{[\`\${styles.card} > &\`]:{ margin: 0 }}})`

describe('selectors', () => {
  test('resolves standalone selector maps and spreads in static and dynamic definitions', () => {
    const result = Graph.compile({
      modules: {
        'shared.ts': `
      import {css} from 'zyzz';
      const parent=css();
      const selectors={'&:hover':{color:'red'},[\`\${parent} > &\`]:{color:'blue'}};
      export const direct=css({selectors});
      export const spread=css({selectors:{...selectors,'&:focus':{color:'green'}}});
      export const dynamic=css((input:{opacity:number})=>({selectors,opacity:input.opacity}));
      const unrelated={selectors:{invalid:{arbitrary:true}}};
    `,
      },
    })

    expect(result.modules['shared.ts']!.css).toMatchInlineSnapshot(`
      ".z-hover-text-red-1ohs7e012mv6jq-0{&:hover{color:red;}}
      .z-text-1ohs7e012mv6jq-1{.z-style-1stl7if1lvmpx3-52 > &{color:blue;}}
      .z-hover-text-red-1aask9k12nif7o-0{&:hover{color:red;}}
      .z-text-1aask9k12nif7o-1{.z-style-1stl7if1lvmpx3-52 > &{color:blue;}}
      .z-focus-text-green-1aask9k12nif7o-2{&:focus{color:green;}}
      .z-hover-text-red-mqr0v612ncb62-0{&:hover{color:red;}}
      .z-text-mqr0v612ncb62-1{.z-style-1stl7if1lvmpx3-52 > &{color:blue;}}
      .z-opacity-mqr0v612ncb62-2{opacity:var(--z-d1stl7if1lvmpx3-297-6f-70-61-63-69-74-79);}"
    `)
  })

  test('compiles empty theme and configured HTML definitions', () => {
    const result = Graph.compile({
      modules: {
        'empty.ts': `import {Config, css, Theme} from 'zyzz';
const theme = Theme.define({});
const config = Config.create({ output: 'html', theme: {} });
export const themed = theme.css();
export const configured = config.css();
export const bare = css()();
export const child = config.css({selectors:{[\`\${themed} > &, \${configured} + &\`]:{ color: 'red' }}});`,
      },
    })

    expect(result.modules['empty.ts']!.code).toMatchInlineSnapshot(`
      "
      import { CompositionHtml as __zyzzCompositionHtml, Props as __zyzzProps } from 'zyzz/runtime';

      const theme = ({className:"z_theme-urrzb11meswl3-theme"} as import('zyzz').Theme.Definition<{}>);
      const config = ({theme:{"className":"z_theme-urrzb11meswl3-config-theme"}} as import('zyzz').Config.create.ReturnType<{readonly "theme":{};readonly "output":"html"}>);
      export const themed = __zyzzProps.create({className:"z-style-urrzb11meswl3-156"});
      export const configured = (__zyzzCompositionHtml.bind(__zyzzProps.create({className:"z-style-urrzb11meswl3-195"})) as import('zyzz').css.ReturnType<'html'>);
      export const bare = ({className:""});
      export const child = (__zyzzCompositionHtml.bind(__zyzzProps.create({className:"z-text-txsfu1vffsxh-0 z-style-urrzb11meswl3-259"})) as import('zyzz').css.ReturnType<'html'>);"
    `)
    expect(result.modules['empty.ts']!.css).toMatchInlineSnapshot(
      `".z-text-txsfu1vffsxh-0{.z-style-urrzb11meswl3-156 > &, .z-style-urrzb11meswl3-195 + &{color:red;}}"`,
    )
  })

  test('compiles namespace definitions and scoped selectors', () => {
    const result = Graph.compile({ modules: { 'app.ts': source } })
    expect(result.modules['app.ts']!.css).toMatchInlineSnapshot(`
      ".z-p-16px-1dcs5wy168f53i-0{padding:16px;}
      .z-text-black-ygpjyk183fbg8-0{color:black;}
      .z-text-ygpjyk183fbg8-1{.z-style-1e8a67z1uaws1j-74:hover &{color:blue;}}
      .z-opacity-ygpjyk183fbg8-2{.z-style-1e8a67z1uaws1j-74 > &:nth-child(even){opacity:0.5;}}
      .z-font-weight-ygpjyk183fbg8-3{.z-style-1e8a67z1uaws1j-122 + &{font-weight:700;}}
      .z-m-1o4lugz181z249-0{.z-style-1e8a67z1uaws1j-74 > &{margin:0;}}"
    `)
    expect(result.modules['app.ts']!.code).toMatchInlineSnapshot(`
      "
      import { Props as __zyzzProps } from 'zyzz/runtime';

      export namespace styles {
        export const card = __zyzzProps.create({className:"z-p-16px-1dcs5wy168f53i-0 z-style-1e8a67z1uaws1j-74"})
        export const empty = __zyzzProps.create({className:"z-style-1e8a67z1uaws1j-122"})
        export const label = __zyzzProps.create({className:"z-text-black-ygpjyk183fbg8-0 z-text-ygpjyk183fbg8-1 z-opacity-ygpjyk183fbg8-2 z-font-weight-ygpjyk183fbg8-3 z-style-1e8a67z1uaws1j-151"})
      }
      export const outside = __zyzzProps.create({className:"z-m-1o4lugz181z249-0 z-style-1e8a67z1uaws1j-334"})"
    `)
  })

  test('resolves aliases and named re-exports across source and packed modules', () => {
    const publisher = Graph.compile({
      modules: {
        'library.ts': `import { css } from 'zyzz'; export const card = css(); export namespace styles { export const button = css({color:'red'}) }`,
        'barrel.ts': `import { card, styles } from './library.js'; export { card as panel, styles }`,
      },
    })
    const app = `import {css} from 'zyzz'; import { panel, styles } from './barrel.js'; const alias = panel; export const label = css({ selectors: {[\`\${alias} > &, \${styles.button} + &\`]: {color:'blue'}} })`
    const result = Graph.compile({
      modules: { 'app.ts': app },
      contracts: publisher.contracts,
      imports: { 'app.ts': { zyzz: null, './barrel.js': 'barrel.ts' } },
    })
    expect(result.modules['app.ts']!.css).toMatchInlineSnapshot(
      `".z-text-16vgepi183c6ym-0{.z-style-ggnaaj17b3mnh-48 > &, .z-style-ggnaaj17b3mnh-103 + &{color:blue;}}"`,
    )
    expect(
      JSON.parse(publisher.contracts['barrel.ts']!).version,
    ).toMatchInlineSnapshot(`17`)
  })

  test('rejects unresolved, called, forward, and unscoped references', () => {
    expect(() =>
      Source.extract({
        moduleId: 'invalid.ts',
        source: `import {css} from 'zyzz'; css({selectors:{[\`\${missing} &\`]:{color:'red'}}})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:46: Selector interpolations require previously declared css definitions.]`,
    )
    expect(() =>
      Source.extract({
        moduleId: 'called.ts',
        source: `import {css} from 'zyzz'; const card=css({}); css({selectors:{[\`\${card()} &\`]:{color:'red'}}})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: called.ts:66: Selector interpolations require css definitions without calling them.]`,
    )
    expect(() =>
      Source.extract({
        moduleId: 'forward.ts',
        source: `import {css} from 'zyzz'; css({selectors:{[\`\${card} &\`]:{color:'red'}}}); const card=css({})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: forward.ts:46: Selector interpolations require previously declared css definitions.]`,
    )
    expect(() =>
      Source.extract({
        moduleId: 'scope.ts',
        source: `import {css} from 'zyzz'; const card=css({}); css({selectors:{[\`\${card}:hover\`]:{color:'red'}}})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: scope.ts:62: Selectors require an explicit & target.]`,
    )
  })

  test('keeps lexical aliases and deduplicated definitions distinct', () => {
    const result = Graph.compile({
      modules: {
        'scoped.ts': `import {css} from 'zyzz';
const card=css({color:'red'}); const alias=card;
const other=css({color:'red'});
function nested(){ const card=other; return css({selectors:{[\`\${alias}:hover &\`]:{color:'blue'}}}) }
export {card,other,nested};`,
      },
    })
    expect(result.modules['scoped.ts']!.code).toMatchInlineSnapshot(`
      "
      import { Props as __zyzzProps } from 'zyzz/runtime';

      const card=__zyzzProps.create({className:"z-text-red-1aonqsg1ferlei-0 z-style-1kmi93w1julwr4-37"}); const alias=card;
      const other=__zyzzProps.create({className:"z-text-red-s35kj31fevje9-0 z-style-1kmi93w1julwr4-87"});
      function nested(){ const card=other; return __zyzzProps.create({className:"z-text-1gjd0291qscdfv-0"}) }
      export {card,other,nested};"
    `)
    expect(result.modules['scoped.ts']!.css).toMatchInlineSnapshot(`
      ".z-text-red-1aonqsg1ferlei-0{color:red;}
      .z-text-red-s35kj31fevje9-0{color:red;}
      .z-text-1gjd0291qscdfv-0{.z-style-1kmi93w1julwr4-37:hover &{color:blue;}}"
    `)
  })

  test('binds dynamic ancestor conditions and rejects descendant slot targets', () => {
    const result = Graph.compile({
      modules: {
        'dynamic.ts': `import {css} from 'zyzz';
const card=css({}); export const label=css((values:{opacity:number})=>({selectors:{[\`\${card}:hover &\`]:{opacity:values.opacity}}}));`,
      },
    })
    expect(result.modules['dynamic.ts']!.code).toMatchInlineSnapshot(`
      "
      import { Props as __zyzzProps } from 'zyzz/runtime';

      const card=__zyzzProps.create({className:"z-style-1h5dayl7tfv4v-37"}); export const label=(((input:Parameters<import('zyzz').css.Dynamic<{opacity:number}>>[0])=>{const v0=input["opacity"] as string | number;const external=input.className;const style=input.style;return {className:external?"z-opacity-ete07xb9xkor-0 z-style-1h5dayl7tfv4v-65"+" "+external:"z-opacity-ete07xb9xkor-0 z-style-1h5dayl7tfv4v-65",style:{...input.variables,...style,"--z-d1h5dayl7tfv4v-65-6f-70-61-63-69-74-79":v0===''?' ':v0}}}) as import('zyzz').css.Dynamic<{opacity:number}>);"
    `)
    expect(() =>
      Source.extract({
        moduleId: 'descendant.ts',
        source: `import {css} from 'zyzz'; css((values:{opacity:number})=>({selectors:{[\`& > span\`]:{opacity:values.opacity}}}))`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Source.ExtractError: descendant.ts:92: Dynamic values require conditions that select the styled element.
      descendant.ts:92: Expected a literal string or number; expressions are not evaluated.]
    `)
  })

  test('rejects unscoped lists, malformed selectors, and missing ampersands', () => {
    expect(() =>
      Source.extract({
        moduleId: 'list.ts',
        source: `import {css} from 'zyzz'; css({selectors:{[\`&:hover, body\`]:{color:'red'}}})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: list.ts:42: Selector lists require explicit & selectors.]`,
    )
    expect(() =>
      Source.extract({
        moduleId: 'syntax.ts',
        source: `import {css} from 'zyzz'; css({selectors:{[\`& > > span\`]:{color:'red'}}})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: syntax.ts:42: Invalid dangling combinator in selector]`,
    )
    expect(() =>
      Source.extract({
        moduleId: 'standalone.ts',
        source: `import {css} from 'zyzz'; css({selectors: {'body': {color: 'red'}}})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: standalone.ts:43: Selectors require an explicit & target.]`,
    )
  })

  test('reuses static selector declarations without interpreting unrelated application data', () => {
    const output = Graph.compile({
      modules: {
        'static.ts': `import {css} from 'zyzz';
const application={selectors:{name:'unrelated'}};
namespace styles {
  export const parent=css();
  const shared={selectors:{[\`\${parent}:hover &\`]:{color:'red'}}};
  export const child=css(shared);
}`,
      },
    })
    expect(output.modules['static.ts']!.css).toMatchInlineSnapshot(
      `".z-text-11xu5e1fx0dm0-0{.z-style-15wl7di1emu9we-117:hover &{color:red;}}"`,
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
