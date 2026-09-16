/**
 * Exercises the public style workflow through real collaborating modules.
 * @module
 */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { style } from 'zyzz'
import { Graph, Source } from 'zyzz/compiler'
import { Css } from 'zyzz/web'

describe('style', () => {
  test('public root bundles for browsers without the source parser', async () => {
    const result = await Esbuild.build({
      bundle: true,
      conditions: ['src'],
      metafile: true,
      platform: 'browser',
      stdin: {
        contents: "export { style, Style } from 'zyzz'",
        resolveDir: process.cwd(),
      },
      write: false,
    })

    expect({
      browserBundle: result.outputFiles.length,
      parserIncluded: Object.keys(result.metafile.inputs).some(
        (path) =>
          path.includes('@babel') ||
          path.includes('oxc-parser') ||
          path.includes('oxc-walker') ||
          path.includes('/compiler/'),
      ),
    }).toMatchInlineSnapshot(`
    {
      "browserBundle": 1,
      "parserIncluded": false,
    }
  `)
  })

  test('literal authoring extracts and returns runtime props', () => {
    const result = Source.extract({
      moduleId: 'example/style.ts',
      source: "import { style } from 'zyzz'; style({ padding: 0 });",
    })

    expect(Css.compile({ styles: result.styles }).css).toMatchInlineSnapshot(
      `".z-p-0{padding:0;}"`,
    )
    expect(style({ padding: 0 })()).toMatchInlineSnapshot(`
      {
        "className": "z-content-1b24kzfsiva6x",
      }
    `)
  })
})

describe('selectors', () => {
  const source = `import {style} from 'zyzz';
export namespace styles {
  export const card = style({ padding: '16px' })
  export const empty = style()
  export const label = style({color: 'black',selectors:{[\`\${card}:hover &\`]:{ color: 'blue' },[\`\${card} > &:nth-child(even)\`]:{ opacity: 0.5 },[\`\${empty} + &\`]:{ fontWeight: 700 }}})
}
export const outside = style({selectors:{[\`\${styles.card} > &\`]:{ margin: 0 }}})`

  describe('selectors', () => {
    test('resolves standalone selector maps and spreads in static and dynamic definitions', () => {
      const result = Graph.compile({
        modules: {
          'shared.ts': `
      import {style} from 'zyzz';
      const parent=style();
      const selectors={'&:hover':{color:'red'},[\`\${parent} > &\`]:{color:'blue'}};
      export const direct=style({selectors});
      export const spread=style({selectors:{...selectors,'&:focus':{color:'green'}}});
      export const dynamic=style((input:{opacity:number})=>({selectors,opacity:input.opacity}));
      const unrelated={selectors:{invalid:{arbitrary:true}}};
    `,
        },
      })

      expect(result.modules['shared.ts']!.css).toMatchInlineSnapshot(`
        ".z-hover-text-red-0Jq0sU-0{&:hover{color:red;}}
        .z-text-1D81Zs-1{.z-style-1stl7if1lvmpx3-54 > &{color:blue;}}
        .z-hover-text-red-7cRIyE-0{&:hover{color:red;}}
        .z-text-DOHDSJ-1{.z-style-1stl7if1lvmpx3-54 > &{color:blue;}}
        .z-focus-text-green-7cRIyE-2{&:focus{color:green;}}
        .z-hover-text-red-T0s3jE-0{&:hover{color:red;}}
        .z-text-wk-1Dw-1{.z-style-1stl7if1lvmpx3-54 > &{color:blue;}}
        .z-opacity-juXi1t-2{opacity:var(--z-d1stl7if1lvmpx3-305-6f-70-61-63-69-74-79);}"
      `)
    })

    test('compiles empty theme and configured HTML definitions', () => {
      const result = Graph.compile({
        modules: {
          'empty.ts': `import { Config, style, Theme } from 'zyzz';
const theme = Theme.define({});
const config = Config.create({ output: 'html', theme: {} });
export const themed = theme.style();
export const configured = config.style();
export const bare = style()();
export const child = config.style({selectors:{[\`\${themed} > &, \${configured} + &\`]:{ color: 'red' }}});`,
        },
      })

      expect(result.modules['empty.ts']!.code).toMatchInlineSnapshot(`
        "
        import { CompositionHtml as __zyzzCompositionHtml, Props as __zyzzProps } from 'zyzz/runtime';

        const theme = ({className:"z_theme-urrzb11meswl3-theme"} as import('zyzz').Theme.Definition<{}>);
        const config = ({theme:{"className":"z_theme-urrzb11meswl3-config-theme"}} as import('zyzz').Config.create.ReturnType<{readonly "theme":{};readonly "output":"html"}>);
        export const themed = __zyzzProps.create({className:"z-style-urrzb11meswl3-160"});
        export const configured = (__zyzzCompositionHtml.bind(__zyzzProps.create({className:"z-style-urrzb11meswl3-201"})) as import('zyzz').style.ReturnType<'html'>);
        export const bare = ({className:""});
        export const child = (__zyzzCompositionHtml.bind(__zyzzProps.create({className:"z-text-uYJ59A-0 z-style-urrzb11meswl3-269"})) as import('zyzz').style.ReturnType<'html'>);"
      `)
      expect(result.modules['empty.ts']!.css).toMatchInlineSnapshot(
        `".z-text-uYJ59A-0{.z-style-urrzb11meswl3-160 > &, .z-style-urrzb11meswl3-201 + &{color:red;}}"`,
      )
    })

    test('compiles namespace definitions and scoped selectors', () => {
      const result = Graph.compile({ modules: { 'app.ts': source } })
      expect(result.modules['app.ts']!.css).toMatchInlineSnapshot(`
        ".z-p-16px-NXxdb9-0{padding:16px;}
        .z-text-black-mlKEVF-0{color:black;}
        .z-text-bzJ65j-1{.z-style-1e8a67z1uaws1j-76:hover &{color:blue;}}
        .z-opacity-jO25_5-2{.z-style-1e8a67z1uaws1j-76 > &:nth-child(even){opacity:0.5;}}
        .z-font-weight-lFhQWE-3{.z-style-1e8a67z1uaws1j-126 + &{font-weight:700;}}
        .z-m-kMGq6d-0{.z-style-1e8a67z1uaws1j-76 > &{margin:0;}}"
      `)
      expect(result.modules['app.ts']!.code).toMatchInlineSnapshot(`
        "
        import { Props as __zyzzProps } from 'zyzz/runtime';

        export namespace styles {
          export const card = __zyzzProps.create({className:"z-p-16px-NXxdb9-0 z-style-1e8a67z1uaws1j-76"})
          export const empty = __zyzzProps.create({className:"z-style-1e8a67z1uaws1j-126"})
          export const label = __zyzzProps.create({className:"z-text-black-mlKEVF-0 z-text-bzJ65j-1 z-opacity-jO25_5-2 z-font-weight-lFhQWE-3 z-style-1e8a67z1uaws1j-157"})
        }
        export const outside = __zyzzProps.create({className:"z-m-kMGq6d-0 z-style-1e8a67z1uaws1j-342"})"
      `)
    })

    test('resolves aliases and named re-exports across source and packed modules', () => {
      const publisher = Graph.compile({
        modules: {
          'library.ts': `import { style } from 'zyzz'; export const card = style(); export namespace styles { export const button = style({color:'red'}) }`,
          'barrel.ts': `import { card, styles } from './library.js'; export { card as panel, styles }`,
        },
      })
      const app = `import {style} from 'zyzz'; import { panel, styles } from './barrel.js'; const alias = panel; export const label = style({ selectors: {[\`\${alias} > &, \${styles.button} + &\`]: {color:'blue'}} })`
      const result = Graph.compile({
        modules: { 'app.ts': app },
        contracts: publisher.contracts,
        imports: { 'app.ts': { zyzz: null, './barrel.js': 'barrel.ts' } },
      })
      expect(result.modules['app.ts']!.css).toMatchInlineSnapshot(
        `".z-text-cGq-9x-0{.z-style-ggnaaj17b3mnh-50 > &, .z-style-ggnaaj17b3mnh-107 + &{color:blue;}}"`,
      )
      expect(
        JSON.parse(publisher.contracts['barrel.ts']!).version,
      ).toMatchInlineSnapshot(`17`)
    })

    test('rejects unresolved, called, forward, and unscoped references', () => {
      expect(() =>
        Source.extract({
          moduleId: 'invalid.ts',
          source: `import {style} from 'zyzz'; style({selectors:{[\`\${missing} &\`]:{color:'red'}}})`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: invalid.ts:50: Selector interpolations require previously declared style definitions.]`,
      )
      expect(() =>
        Source.extract({
          moduleId: 'called.ts',
          source: `import {style} from 'zyzz'; const card=style({}); style({selectors:{[\`\${card()} &\`]:{color:'red'}}})`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: called.ts:72: Selector interpolations require style definitions without calling them.]`,
      )
      expect(() =>
        Source.extract({
          moduleId: 'forward.ts',
          source: `import {style} from 'zyzz'; style({selectors:{[\`\${card} &\`]:{color:'red'}}}); const card=style({})`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: forward.ts:50: Selector interpolations require previously declared style definitions.]`,
      )
      expect(() =>
        Source.extract({
          moduleId: 'scope.ts',
          source: `import {style} from 'zyzz'; const card=style({}); style({selectors:{[\`\${card}:hover\`]:{color:'red'}}})`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: scope.ts:68: Selectors require an explicit & target.]`,
      )
    })

    test('keeps lexical aliases and deduplicated definitions distinct', () => {
      const result = Graph.compile({
        modules: {
          'scoped.ts': `import {style} from 'zyzz';
const card=style({color:'red'}); const alias=card;
const other=style({color:'red'});
function nested(){ const card=other; return style({selectors:{[\`\${alias}:hover &\`]:{color:'blue'}}}) }
export {card,other,nested};`,
        },
      })
      expect(result.modules['scoped.ts']!.code).toMatchInlineSnapshot(`
        "
        import { Props as __zyzzProps } from 'zyzz/runtime';

        const card=__zyzzProps.create({className:"z-text-red-JVDBqH-0 z-style-1kmi93w1julwr4-39"}); const alias=card;
        const other=__zyzzProps.create({className:"z-text-red-8fFQWb-0 z-style-1kmi93w1julwr4-91"});
        function nested(){ const card=other; return __zyzzProps.create({className:"z-text-p1JECT-0"}) }
        export {card,other,nested};"
      `)
      expect(result.modules['scoped.ts']!.css).toMatchInlineSnapshot(`
        ".z-text-red-JVDBqH-0{color:red;}
        .z-text-red-8fFQWb-0{color:red;}
        .z-text-p1JECT-0{.z-style-1kmi93w1julwr4-39:hover &{color:blue;}}"
      `)
    })

    test('binds dynamic ancestor conditions and rejects descendant slot targets', () => {
      const result = Graph.compile({
        modules: {
          'dynamic.ts': `import {style} from 'zyzz';
const card=style({}); export const label=style((values:{opacity:number})=>({selectors:{[\`\${card}:hover &\`]:{opacity:values.opacity}}}));`,
        },
      })
      expect(result.modules['dynamic.ts']!.code).toMatchInlineSnapshot(`
        "
        import { Props as __zyzzProps } from 'zyzz/runtime';

        const card=__zyzzProps.create({className:"z-style-1h5dayl7tfv4v-39"}); export const label=(((input:Parameters<import('zyzz').style.Dynamic<{opacity:number}>>[0])=>{const v0=input["opacity"] as string | number;const external=input.className;const style=input.style;return {className:external?"z-opacity-rAgY3A-0 z-style-1h5dayl7tfv4v-69"+" "+external:"z-opacity-rAgY3A-0 z-style-1h5dayl7tfv4v-69",style:{...input.variables,...style,"--z-d1h5dayl7tfv4v-69-6f-70-61-63-69-74-79":v0===''?' ':v0}}}) as import('zyzz').style.Dynamic<{opacity:number}>);"
      `)
      expect(() =>
        Source.extract({
          moduleId: 'descendant.ts',
          source: `import {style} from 'zyzz'; style((values:{opacity:number})=>({selectors:{[\`& > span\`]:{opacity:values.opacity}}}))`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(`
        [Source.ExtractError: descendant.ts:96: Dynamic values require conditions that select the styled element.
        descendant.ts:96: Expected a literal string or number; expressions are not evaluated.]
      `)
    })

    test('rejects unscoped lists, malformed selectors, and missing ampersands', () => {
      expect(() =>
        Source.extract({
          moduleId: 'list.ts',
          source: `import {style} from 'zyzz'; style({selectors:{[\`&:hover, body\`]:{color:'red'}}})`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: list.ts:46: Selector lists require explicit & selectors.]`,
      )
      expect(() =>
        Source.extract({
          moduleId: 'syntax.ts',
          source: `import {style} from 'zyzz'; style({selectors:{[\`& > > span\`]:{color:'red'}}})`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: syntax.ts:46: Invalid dangling combinator in selector]`,
      )
      expect(() =>
        Source.extract({
          moduleId: 'standalone.ts',
          source: `import {style} from 'zyzz'; style({selectors: {'body': {color: 'red'}}})`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: standalone.ts:47: Selectors require an explicit & target.]`,
      )
    })

    test('reuses static selector declarations without interpreting unrelated application data', () => {
      const output = Graph.compile({
        modules: {
          'static.ts': `import {style} from 'zyzz';
const application={selectors:{name:'unrelated'}};
namespace styles {
  export const parent=style();
  const shared={selectors:{[\`\${parent}:hover &\`]:{color:'red'}}};
  export const child=style(shared);
}`,
        },
      })
      expect(output.modules['static.ts']!.css).toMatchInlineSnapshot(
        `".z-text-rR8AAE-0{.z-style-15wl7di1emu9we-119:hover &{color:red;}}"`,
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
})
