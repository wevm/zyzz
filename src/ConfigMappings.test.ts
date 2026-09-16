/** Exercises property aliases and dedicated spacing tokens through packed compilation and browser rendering. @module */
import * as Vm from 'node:vm'
import * as Packed from '../test/fixtures/Packed.js'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'
import { Config, Style } from 'zyzz'

describe('create', () => {
  test('retains alias source paths in structural diagnostics', () => {
    const { theme } = Config.create({
      theme: {},
      shorthands: { px: ['paddingLeft', 'paddingRight'] },
    })

    try {
      Style.define(
        // @ts-expect-error exercise unchecked invalid fallback input
        { card: { px: [] } },
        {
          theme,
          locations: [
            { path: ['card', 'px'], source: 'app.ts', start: 10, end: 12 },
          ],
        },
      )
      throw new Error('Expected invalid fallback')
    } catch (error) {
      expect((error as Style.InvalidError).diagnostics).toMatchInlineSnapshot(`
      [
        {
          "code": "invalid_value",
          "location": {
            "end": 12,
            "path": [
              "card",
              "px",
            ],
            "source": "app.ts",
            "start": 10,
          },
          "message": "Fallback arrays must be nonempty.",
          "path": [
            "card",
            "px",
          ],
        },
        {
          "code": "invalid_value",
          "location": {
            "end": 12,
            "path": [
              "card",
              "px",
            ],
            "source": "app.ts",
            "start": 10,
          },
          "message": "Fallback arrays must be nonempty.",
          "path": [
            "card",
            "px",
          ],
        },
      ]
    `)
    }
  })

  test('writes version five for dedicated spacing groups without aliases', () => {
    const result = Graph.compile({
      modules: {
        'config.ts': `import {Config} from 'zyzz';export const {theme}=Config.create({theme:{margin:{gap:'-4px'},padding:{gap:'4px'}}});`,
      },
    })

    expect(
      JSON.parse(result.contracts['config.ts']!).version,
    ).toMatchInlineSnapshot(`17`)
  })
  test('preserves mapped HTML theme handles through source and packed aliases', async () => {
    const library = Graph.compile({
      modules: {
        'index.ts': `import {Config} from 'zyzz';const config=Config.create({output:'html',theme:{padding:{sm:'4px'}},shorthands:{px:['paddingLeft','paddingRight']}});export const theme=config.theme;export const bound=theme.style;export const staticStyle=bound({px:'sm'});`,
      },
    })

    const app = Graph.compile({
      contracts: { 'library/index.js': library.contracts['index.ts']! },
      imports: { 'app.ts': { library: 'library/index.js', zyzz: null } },
      modules: {
        'app.ts': `import {Theme} from 'zyzz';import {theme,staticStyle} from 'library';const extended=Theme.extend(theme,{padding:{sm:'12px'}});export const extension=extended.style({px:'sm'})();const {style}=theme;export const destructured=style({px:'sm'})();const bound=theme.style;export const dynamic=bound((values:{width:'4px'|'8px'})=>({px:values.width}))({width:'8px'});export const direct=theme.style({px:'sm'})();export const source=staticStyle();`,
      },
    })

    const code = await Packed.bundle({
      entry: 'app.ts',
      modules: { 'app.ts': app.modules['app.ts']!.code },
      packages: { library: { 'index.ts': library.modules['index.ts']!.code } },
    })

    const result = Vm.runInNewContext(`${code};Fixture;`)

    for (const props of [
      result.direct,
      result.source,
      result.dynamic,
      result.extension,
      result.destructured,
    ]) {
      expect(typeof props.class).toMatchInlineSnapshot('"string"')
      expect(props.className).toMatchInlineSnapshot('undefined')
    }

    expect(typeof result.dynamic.style).toMatchInlineSnapshot('"string"')
    expect(result.direct).toMatchInlineSnapshot(`
      {
        "class": "z-pl-rTuHcE-0 z-pr-XwpZ0V-1",
      }
    `)
    expect(result.source).toMatchInlineSnapshot(`
      {
        "class": "z-pl-ECFxVx-0 z-pr-Ar0hzP-1 z-style-1wfnqsmu0q6os-234",
      }
    `)
    expect(result.dynamic).toMatchInlineSnapshot(`
      {
        "class": "z-pl-MXp9W9-0 z-pr-0P3zkT-1",
        "style": "--z-d1e8a67z1uaws1j-287-77-69-64-74-68:8px",
      }
    `)
  })

  const config = `import {Config} from 'zyzz';export const {style,theme}=Config.create({shorthands:{px:['paddingLeft','paddingRight'],paddingX:['paddingLeft','paddingRight'],space:['marginLeft','paddingLeft']},theme:{spacing:{sm:'4px'},margin:{sm:'-8px'},padding:{sm:'12px'}}});`
  const source = `import {style,theme} from 'library';export namespace styles {
  export const card = style({px:'sm',paddingLeft:'2px',':hover':{paddingX:'sm!'}})

  export const mixed = style({space:'sm'})

  export const handle = theme.style({px:'sm'})

  export const dynamic = style((values:{width:'10px'|'20px'})=>({px:values.width}))
}`

  function compile() {
    const library = Graph.compile({
      modules: {
        'config.ts': config,
        'index.ts': `export {style,theme} from './config.js';`,
      },
    })

    const app = Graph.compile({
      contracts: { 'library/index.js': library.contracts['index.ts']! },
      imports: { 'app.ts': { library: 'library/index.js' } },
      modules: { 'app.ts': source },
    })

    return { app, library }
  }

  test('rejects non-record shorthand containers', () => {
    expect(() =>
      Config.create({
        shorthands: new Map([['px', ['paddingLeft']]]),
      } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Config.InvalidError: shorthands must be a property mapping record.]`,
    )
  })
  test('accepts reordered alias keys with identical target tuples', () => {
    const { library } = compile()
    const first = JSON.parse(library.contracts['config.ts']!)
    const second = JSON.parse(library.contracts['config.ts']!)

    for (const theme of Object.values(second.themes) as {
      shorthands: Record<string, string[]>
    }[])
      theme.shorthands = Object.fromEntries(
        Object.entries(theme.shorthands).reverse(),
      )

    const output = Graph.compile({
      contracts: {
        'a.js': JSON.stringify(first),
        'b.js': JSON.stringify(second),
      },
      imports: { 'app.ts': { a: 'a.js', b: 'b.js' } },
      modules: {
        'app.ts': `import {style as a} from 'a';import {style as b} from 'b';export const card=a({px:'sm'})`,
      },
    })

    expect(
      output.modules['app.ts']!.css.includes('padding-left'),
    ).toMatchInlineSnapshot('true')
  })
  test('rejects conflicting packed mappings before reusing theme identities', () => {
    const { library } = compile()
    const original = library.contracts['config.ts']!
    const changed = JSON.parse(original)

    expect(changed.version).toMatchInlineSnapshot(`17`)

    for (const value of Object.values(changed.themes) as {
      shorthands: Record<string, string[]>
    }[])
      value.shorthands.px = ['marginLeft', 'marginRight']

    expect(() =>
      Graph.compile({
        contracts: { 'a.js': original, 'b.js': JSON.stringify(changed) },
        imports: { 'app.ts': { a: 'a.js', b: 'b.js' } },
        modules: {
          'app.ts': `import {style as a} from 'a';import {style as b} from 'b';export namespace styles {export const first=a({px:'sm'});export const second=b({px:'sm'});}`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: b.js:0: Invalid library contract: Conflicting packed shorthand mappings for one theme identity.]`,
    )
  })
  test('retains mapped extension annotations through packed exports', () => {
    const library = Graph.compile({
      modules: {
        'theme.ts': `import {Config,Theme} from 'zyzz';const {theme}=Config.create({shorthands:{px:['paddingLeft','paddingRight']},theme:{spacing:{sm:'4px'}}});export const extended=Theme.extend(theme,{spacing:{sm:'8px'}});`,
      },
    })

    expect(
      library.modules['theme.ts']!.code.includes('shorthands:'),
    ).toMatchInlineSnapshot('true')

    const consumer = Graph.compile({
      contracts: { 'lib.js': library.contracts['theme.ts']! },
      imports: { 'app.ts': { lib: 'lib.js', zyzz: null } },
      modules: {
        'app.ts': `import {Theme} from 'zyzz';import {extended} from 'lib';export const next=Theme.extend(extended,{spacing:{sm:'12px'}});export const card=next.style({px:'sm'});`,
      },
    })

    expect(
      consumer.modules['app.ts']!.code.includes('shorthands:'),
    ).toMatchInlineSnapshot('true')
    expect(consumer.modules['app.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1xn44ix111xh3v-theme-theme{--z-t1xn44ix111xh3v-theme-spacing_2e_sm:4px;}
      .z_theme-1xn44ix111xh3v-extended{--z-t1xn44ix111xh3v-theme-spacing_2e_sm:8px;}
      .z_theme-1e8a67z1uaws1j-next{--z-t1xn44ix111xh3v-theme-spacing_2e_sm:12px;}
      .z-pl-OJ5iBP-0{padding-left:var(--z-t1xn44ix111xh3v-theme-spacing_2e_sm,12px);}
      .z-pr-B_AHva-1{padding-right:var(--z-t1xn44ix111xh3v-theme-spacing_2e_sm,12px);}"
    `)
  })
  test('accepts quoted aliases and independently validates numeric targets', () => {
    const graph = Graph.compile({
      modules: {
        'app.ts': `import {Config,Theme} from 'zyzz';const {style,theme}=Config.create({shorthands:{'padding-x':['paddingLeft','paddingRight'],mixed:['scale','order']},theme:{spacing:{sm:'4px'}}});const extended=Theme.extend(theme,{spacing:{sm:'8px'}});export namespace styles {
  export const card = extended.style({'padding-x':'sm'})

  export const dynamic = style((values:{n:1|2})=>({mixed:values.n}))
}`,
      },
    })

    expect(graph.modules['app.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1e8a67z1uaws1j-style-theme{--z-t1e8a67z1uaws1j-style-spacing_2e_sm:4px;}
      .z_theme-1e8a67z1uaws1j-extended{--z-t1e8a67z1uaws1j-style-spacing_2e_sm:8px;}
      .z-pl-6wJSfX-0{padding-left:var(--z-t1e8a67z1uaws1j-style-spacing_2e_sm,8px);}
      .z-pr-B4Vpd4-1{padding-right:var(--z-t1e8a67z1uaws1j-style-spacing_2e_sm,8px);}
      .z-scale-RSMJdB{scale:var(--z-d1e8a67z1uaws1j-343-6e);}
      .z-order-zJSzEd{order:var(--z-d1e8a67z1uaws1j-343-6e);}"
    `)
  })
  test('preserves ordered targets and spacing precedence across packed imports', () => {
    const { app } = compile()

    expect(app.modules['app.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-u8smm21l81sow-style-theme{--z-tu8smm21l81sow-style-margin_2e_sm:-8px;--z-tu8smm21l81sow-style-padding_2e_sm:12px;--z-tu8smm21l81sow-style-spacing_2e_sm:4px;}
      .z-pl-KWN2eh-0{padding-left:var(--z-tu8smm21l81sow-style-padding_2e_sm,12px);}
      .z-pr-Fc2gxL-1{padding-right:var(--z-tu8smm21l81sow-style-padding_2e_sm,12px);}
      .z-pl-2px-CGhyBp-2{padding-left:2px;}
      .z-hover-pl-eR_rpb-3{&:hover{padding-left:var(--z-tu8smm21l81sow-style-padding_2e_sm,12px)!important;}}
      .z-hover-pr-TDwfLY-4{&:hover{padding-right:var(--z-tu8smm21l81sow-style-padding_2e_sm,12px)!important;}}
      .z-ml-3m0U8T-0{margin-left:var(--z-tu8smm21l81sow-style-margin_2e_sm,-8px);}
      .z-pl-_QgQjn-1{padding-left:var(--z-tu8smm21l81sow-style-padding_2e_sm,12px);}
      .z-pl-vwHld9-0{padding-left:var(--z-tu8smm21l81sow-style-padding_2e_sm,12px);}
      .z-pr-kE9aGi-1{padding-right:var(--z-tu8smm21l81sow-style-padding_2e_sm,12px);}
      .z-pl-B0PUf3-0{padding-left:var(--z-d1e8a67z1uaws1j-263-77-69-64-74-68);}
      .z-pr-tL3c5O-1{padding-right:var(--z-d1e8a67z1uaws1j-263-77-69-64-74-68);}"
    `)
    expect(app.modules['app.ts']!.code.includes('px:')).toMatchInlineSnapshot(
      'false',
    )
  })
  test('rebuilds consumers after a mapping edit', () => {
    const graph = Graph.create()
    const modules = {
      'config.ts': config,
      'app.ts': `import {style} from './config.js';export const card=style({px:'sm'});`,
    }
    const before = graph.compile({ modules })

    const after = graph.compile({
      modules: {
        ...modules,
        'config.ts': config.replace(
          "px:['paddingLeft','paddingRight']",
          "px:['paddingTop','paddingBottom']",
        ),
      },
    })

    expect(
      before.modules['app.ts']!.css.includes('padding-left:'),
    ).toMatchInlineSnapshot('true')
    expect(
      after.modules['app.ts']!.css.includes('padding-left:'),
    ).toMatchInlineSnapshot('false')
    expect(
      after.modules['app.ts']!.css.includes('padding-top:'),
    ).toMatchInlineSnapshot('true')
  })
  test('rejects packed option mappings that disagree with the linked theme', () => {
    const { library } = compile()
    const contract = JSON.parse(library.contracts['config.ts']!)

    contract.exports.style.options.shorthands = {
      mx: ['marginLeft', 'marginRight'],
    }

    expect(() =>
      Graph.compile({
        contracts: { 'lib.js': JSON.stringify(contract) },
        imports: { 'app.ts': { lib: 'lib.js' } },
        modules: {
          'app.ts': `import {style} from 'lib';export const card=style({mx:'sm'})`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: lib.js:0: Invalid library contract: Configuration mappings disagree with linked theme metadata.]`,
    )
  })
  test('rejects present falsy packed mappings', () => {
    const { library } = compile()

    for (const value of [null, false, 0, '']) {
      const contract = JSON.parse(library.contracts['config.ts']!)

      for (const theme of Object.values(contract.themes) as {
        shorthands: unknown
      }[])
        theme.shorthands = value

      expect(() =>
        Graph.compile({
          contracts: { 'lib.js': JSON.stringify(contract) },
          imports: { 'app.ts': { lib: 'lib.js' } },
          modules: {
            'app.ts': `import {style} from 'lib';export const card=style({color:'red'})`,
          },
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: lib.js:0: Invalid library contract: shorthands must be a property mapping record.]`,
      )
    }
  })
  test('rejects invalid mappings', () => {
    const invalid = [
      '{px:[]}',
      "{px:['paddingLeft','paddingLeft']}",
      "{px:['notAProperty']}",
      "{padding:['paddingLeft']}",
      "{px:['paddingX'],paddingX:['paddingLeft']}",
    ]

    const errors = invalid.map((shorthands) => {
      try {
        Graph.compile({
          modules: {
            'config.ts': `import {Config} from 'zyzz';export const config=Config.create({shorthands:${shorthands}});`,
          },
        })

        return 'accepted'
      } catch (error) {
        return (error as Error).message
      }
    })

    expect(errors).toMatchInlineSnapshot(`
      [
        "config.ts:48: Shorthand px requires a nonempty property tuple.",
        "config.ts:48: Shorthand px requires unique standard properties.",
        "config.ts:48: Shorthand px requires unique standard properties.",
        "config.ts:48: Invalid shorthand name: padding",
        "config.ts:48: Shorthand px requires unique standard properties.",
      ]
    `)
  })
  test('renders alias order, nested importance, and dynamic slots in Chromium', async () => {
    const { app, library } = compile()

    const bundle = await Packed.bundle({
      entry: 'app.ts',
      modules: { 'app.ts': app.modules['app.ts']!.code },
      packages: { library: { 'index.ts': library.modules['config.ts']!.code } },
    })

    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()

      await page.setContent(
        `<style>${app.modules['app.ts']!.css}</style><div id="card">Card</div><div id="mixed"></div><div id="dynamic"></div>`,
      )
      await page.addScriptTag({ content: bundle })
      await page.evaluate(
        `for(const id of ['card','mixed','dynamic']){const props=Fixture.styles[id](id==='dynamic'?{width:'20px'}:{});const el=document.getElementById(id);el.className=props.className;for(const [key,value]of Object.entries(props.style??{})){if(key.startsWith('--'))el.style.setProperty(key,String(value));else el.style[key]=value}}`,
      )

      expect(
        await page
          .locator('#card')
          .evaluate((el) => getComputedStyle(el).paddingLeft),
      ).toMatchInlineSnapshot('"2px"')
      expect(
        await page
          .locator('#card')
          .evaluate((el) => getComputedStyle(el).paddingRight),
      ).toMatchInlineSnapshot('"12px"')
      expect(
        await page
          .locator('#mixed')
          .evaluate((el) => getComputedStyle(el).marginLeft),
      ).toMatchInlineSnapshot('"-8px"')
      expect(
        await page
          .locator('#mixed')
          .evaluate((el) => getComputedStyle(el).paddingLeft),
      ).toMatchInlineSnapshot('"12px"')
      expect(
        await page
          .locator('#dynamic')
          .evaluate((el) => getComputedStyle(el).paddingRight),
      ).toMatchInlineSnapshot('"20px"')

      await page.locator('#card').hover()

      expect(
        await page
          .locator('#card')
          .evaluate((el) => getComputedStyle(el).paddingLeft),
      ).toMatchInlineSnapshot('"12px"')
    } finally {
      await browser.close()
    }
  })
})
