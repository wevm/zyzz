/**
 * Exercises the public Theme workflow through real collaborating modules.
 * @module
 */
import { tokens as contextTokens } from './default.js'
import * as Util from 'node:util'
const bundled = Vars.define(contextTokens)
import * as Packed from '../test/fixtures/Packed.js'
import * as Trace from '@jridgewell/trace-mapping'
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Style, Vars } from 'zyzz'
import * as Theme from './internal/Theme.js'
import { Graph, Transform } from 'zyzz/compiler'
import { StyleSheet } from 'zyzz/react-native'
import { Css } from 'zyzz/web'

const tokens = {
  backgroundColor: { surface: { dark: '#111', light: '#fff' } },
  color: { brand: '#06c', unused: '#f00' },
  spacing: { md: '8px' },
} as const

describe('define', () => {
  test.each([
    'cx(heading(), border())',
    'cx(enabled && heading(), border())',
    'cx(cx(heading(), border()), border())',
  ])('preserves typography source maps through %s', (composition) => {
    const output = Transform.compile({
      moduleId: 'composition.ts',
      source: `import {Config,cx} from 'zyzz';
const {style}=Config.create({vars:{breakpoint:{tablet:'800px'},typography:{heading:{fontFamily:'serif',fontSize:'24px','@media >=tablet':{fontSize:'40px'}}}}});
const heading=style({
  typography:'heading',
  '@media (min-width: 1000px)': { fontWeight: 500 },
});
const border=style({borderWidth:'2px'});
declare const enabled:boolean;
export const combined=${composition};`,
    })
    const mappings: Record<string, Set<number | null>> = {}
    Trace.eachMapping(
      new Trace.TraceMap(output.cssMap),
      ({ name, originalLine }) => {
        if (
          name &&
          [
            'fontSize',
            'fontFamily',
            'fontWeight',
            'borderWidth',
            'typography',
            "'@media (min-width: 1000px)'",
          ].includes(name)
        )
          (mappings[name] ??= new Set()).add(originalLine)
      },
    )
    expect(mappings).toMatchInlineSnapshot(`
      {
        "'@media (min-width: 1000px)'": Set {
          5,
        },
        "borderWidth": Set {
          7,
        },
        "fontFamily": Set {
          4,
        },
        "fontSize": Set {
          4,
        },
        "fontWeight": Set {
          5,
        },
        "typography": Set {
          4,
        },
      }
    `)
  })

  test('maps responsive typography declarations to the authored preset', () => {
    const output = Transform.compile({
      moduleId: 'responsive.ts',
      source: `import {Config} from 'zyzz';
const {style}=Config.create({vars:{breakpoint:{tablet:'800px'},typography:{heading:{fontSize:'24px','@media >=tablet':{fontSize:'40px',lineHeight:'48px'}}}}});
export const heading=style({
  typography: 'heading',
  fontWeight: 500,
});`,
    })
    const mappings: Record<string, number | null> = {}
    Trace.eachMapping(
      new Trace.TraceMap(output.cssMap),
      ({ name, originalLine }) => {
        if (name) mappings[name] = originalLine
      },
    )
    expect(mappings).toMatchInlineSnapshot(`
      {
        "1up51euxshgne-style-theme": 2,
        "fontSize": 4,
        "fontWeight": 5,
        "lineHeight": 4,
        "style-1up51euxshgne-210": 3,
        "typography": 4,
      }
    `)
  })

  test('compiles native border tokens and rejects unsupported responsive queries', () => {
    const theme = Theme.define({
      borderWidth: { regular: '2px' },
      breakpoint: { tablet: '800px' },
      typography: {
        heading: { fontSize: '24px', '@media >=tablet': { fontSize: '40px' } },
      },
    })
    const output = StyleSheet.compile({
      styles: Style.define(
        { border: { borderWidth: 'regular' } },
        { vars: theme },
      ),
      vars: { base: theme },
    })
    expect(output.styles.base.light.border).toMatchInlineSnapshot(`
      {
        "borderBottomWidth": 2,
        "borderLeftWidth": 2,
        "borderRightWidth": 2,
        "borderTopWidth": 2,
      }
    `)
    expect(() =>
      StyleSheet.compile({
        styles: Style.define(
          { heading: { typography: 'heading' } },
          { vars: theme },
        ),
        vars: { base: theme },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[StyleSheet.CompileError: ["heading"]: Selectors, queries, and nested rules are not supported on native.]`,
    )
  })

  test('renders responsive theme typography and border widths through packed configuration', async () => {
    const library = Graph.compile({
      modules: {
        'theme.ts': `import {Config,Vars} from 'zyzz';
const base=Vars.define({
  borderWidth:{regular:'2px',hairline:'0.5px'},
  breakpoint:{tablet:'800px'},
  container:{card:'300px'},
  typography:{heading:{fontSize:'24px',lineHeight:'30px',
    '@media >=tablet':{fontSize:'40px',lineHeight:'48px'},
    '@media (min-width: 1000.5px)':{fontSize:'48px',
      '@container >=card':{lineHeight:'60px'}}}}
});
const alternate=Vars.extend(base,{
  borderWidth:{regular:'4px'},
  typography:{heading:{'@media >=tablet':{fontSize:'44px'}}}
});
export const {style,vars}=Config.create({vars:{base,alternate},defaultVars:'base'});`,
      },
    })
    const contract = library.contracts['theme.ts']!
    expect(JSON.parse(contract).version).toMatchInlineSnapshot(`28`)
    const source = `import {style,vars} from 'library';
export const title=style({typography:'heading',borderStyle:'solid',borderWidth:'regular'});
export const fixed=style({typography:'heading',fontSize:'18px'});
export const important=style({typography:'heading !important'});
export const logical=style({borderInlineStartStyle:'solid',borderInlineStartWidth:'regular'});
export const root=vars().className;
export const other=vars({set:'alternate'}).className;`
    expect(() =>
      Graph.compile({
        contracts: {
          'library.js': JSON.stringify({
            ...JSON.parse(contract),
            version: 24,
          }),
        },
        imports: { 'app.ts': { library: 'library.js' } },
        modules: { 'app.ts': source },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: library.js:0: Invalid library contract: Vars contracts require contract version 26 or later.]`,
    )
    const consumer = Graph.compile({
      contracts: { 'library.js': contract },
      imports: { 'app.ts': { library: 'library.js' } },
      modules: { 'app.ts': source },
    })
    const output = consumer.modules['app.ts']!
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage({
        viewport: { width: 600, height: 400 },
      })
      await page.setContent(
        `<style>${output.css}</style><main style="container-type:inline-size"><p id="title">Title</p><p id="fixed">Fixed</p><p id="important" style="font-size:10px">Important</p><p id="logical">Logical</p></main>`,
      )
      const script = await Packed.bundle({
        entry: 'app.ts',
        modules: {
          'app.ts':
            output.code +
            `
          document.querySelector('main').className=root;
          for(const [id,style] of Object.entries({title,fixed,important,logical})) document.getElementById(id).className=style().className;
          window.alternate=other;`,
        },
        packages: {
          library: { 'index.ts': library.modules['theme.ts']!.code },
        },
      })
      await page.addScriptTag({ content: script })
      await page.waitForFunction(
        () => document.querySelector('#title')!.className !== '',
      )
      expect(
        await page
          .locator('#title')
          .evaluate((element) => getComputedStyle(element).fontSize),
      ).toMatchInlineSnapshot(`"24px"`)
      expect(
        await page
          .locator('#title')
          .evaluate((element) => getComputedStyle(element).borderTopWidth),
      ).toMatchInlineSnapshot(`"2px"`)
      expect(
        await page
          .locator('#logical')
          .evaluate(
            (element) => getComputedStyle(element).borderInlineStartWidth,
          ),
      ).toMatchInlineSnapshot(`"2px"`)
      await page.setViewportSize({ width: 900, height: 400 })
      expect(
        await page
          .locator('#title')
          .evaluate((element) => getComputedStyle(element).fontSize),
      ).toMatchInlineSnapshot(`"40px"`)
      expect(
        await page
          .locator('#title')
          .evaluate((element) => getComputedStyle(element).lineHeight),
      ).toMatchInlineSnapshot(`"48px"`)
      expect(
        await page
          .locator('#fixed')
          .evaluate((element) => getComputedStyle(element).fontSize),
      ).toMatchInlineSnapshot(`"18px"`)
      expect(
        await page
          .locator('#important')
          .evaluate((element) => getComputedStyle(element).fontSize),
      ).toMatchInlineSnapshot(`"40px"`)
      await page.evaluate(
        'document.querySelector("main").className=window.alternate',
      )
      expect(
        await page
          .locator('#title')
          .evaluate((element) => getComputedStyle(element).fontSize),
      ).toMatchInlineSnapshot(`"44px"`)
      expect(
        await page
          .locator('#title')
          .evaluate((element) => getComputedStyle(element).borderTopWidth),
      ).toMatchInlineSnapshot(`"4px"`)
      await page.setViewportSize({ width: 1100, height: 400 })
      expect(
        await page
          .locator('#title')
          .evaluate((element) => getComputedStyle(element).fontSize),
      ).toMatchInlineSnapshot(`"48px"`)
      expect(
        await page
          .locator('#title')
          .evaluate((element) => getComputedStyle(element).lineHeight),
      ).toMatchInlineSnapshot(`"60px"`)
      expect(
        await page
          .locator('#fixed')
          .evaluate((element) => getComputedStyle(element).fontSize),
      ).toMatchInlineSnapshot(`"18px"`)
    } finally {
      await browser.close()
    }
  })

  test('rejects malformed typography queries', () => {
    const theme = Theme.define({
      typography: {
        heading: { '@media (min-width: 800px)': { fontSize: '24px' } },
      },
    })
    expect(() =>
      Style.define(
        {
          heading: { typography: 'heading.@media (min-width: 800px)' },
        } as never,
        { vars: theme },
      ),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Style.InvalidError: ["heading","typography"]: Expected a named typography set from the bound theme.]`,
    )
    expect(() =>
      Theme.define({
        typography: {
          heading: { '@supports (display: grid)': { fontSize: '24px' } },
        },
      } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Theme.InvalidError: ["typography","heading","@supports (display: grid)"]: Typography conditions must be media or container queries.]`,
    )
    expect(() =>
      Theme.define({
        typography: { heading: { '@media >=missing': { fontSize: '24px' } } },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Theme.InvalidError: ["typography","heading","@media >=missing"]: Unknown query threshold.]`,
    )
    expect(() =>
      Theme.define({
        typography: {
          heading: {
            '@media (min-width: 800px)': { other: { fontSize: '24px' } },
          },
        },
      } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Theme.InvalidError: ["typography","heading","@media (min-width: 800px)","other"]: Typography query blocks accept only typography fields and queries.]`,
    )
    expect(() =>
      Theme.define({
        typography: { '@media (min-width: 800px)': { fontSize: '24px' } },
      } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Theme.InvalidError: ["typography","@media (min-width: 800px)"]: Typography properties require a named set.]`,
    )
  })

  test.each(['body', 'body !important', 'body  !important'])(
    'maps expanded typography fields to their authored declaration: %s',
    (typography) => {
      const source = `import {Config} from 'zyzz';
const {style}=Config.create({vars:{typography:{body:{fontSize:'14px',fontWeight:400,lineHeight:'20px'}}}});
export const body=style({
  fontWeight: 500,
  typography: '${typography}',
  ':hover': { typography: 'body', lineHeight: '24px' },
});`
      const output = Transform.compile({ moduleId: 'typography.ts', source })
      const map = new Trace.TraceMap(output.cssMap)
      const mappings: Record<
        string,
        { line: number | null; column: number | null }[]
      > = {}
      Trace.eachMapping(map, ({ name, originalLine, originalColumn }) => {
        if (name && ['fontSize', 'fontWeight', 'lineHeight'].includes(name))
          (mappings[name] ??= []).push({
            line: originalLine,
            column: originalColumn,
          })
      })

      expect(mappings).toMatchInlineSnapshot(`
      {
        "fontSize": [
          {
            "column": 2,
            "line": 5,
          },
          {
            "column": 14,
            "line": 6,
          },
        ],
        "fontWeight": [
          {
            "column": 2,
            "line": 4,
          },
          {
            "column": 14,
            "line": 6,
          },
        ],
        "lineHeight": [
          {
            "column": 2,
            "line": 5,
          },
          {
            "column": 34,
            "line": 6,
          },
        ],
      }
    `)
    },
  )

  test('rejects malformed typography data', () => {
    expect(() =>
      Theme.define({ typography: { heading: { 32: '32px' } } } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Theme.InvalidError: ["typography","heading","32"]: Expected a typography set or a nested set group.]`,
    )
    expect(() =>
      Theme.define({
        typography: { body: { fontSize: { small: '14px' } } },
      } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Theme.InvalidError: ["typography","body","fontSize"]: Typography properties require scalar values.]`,
    )
    expect(() =>
      Theme.define({ typography: { body: { color: 'red' } } } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Theme.InvalidError: ["typography","body","color"]: Expected a typography set or a nested set group.]`,
    )
    expect(() =>
      Theme.define({ typography: { body: {} } } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Theme.InvalidError: ["typography","body"]: Token palettes cannot be empty.]`,
    )
  })

  test('renders typography sets, explicit fields, conditions, and theme overrides', async () => {
    const base = Theme.define({
      typography: {
        heading: {
          32: {
            fontFamily: 'Geist',
            fontSize: '32px',
            fontWeight: 600,
            letterSpacing: '-1.28px',
            lineHeight: '40px',
          },
        },
        label: {
          14: {
            fontSize: '14px',
            mono: {
              fontFamily: 'Geist Mono',
              fontSize: '14px',
              lineHeight: '20px',
            },
          },
        },
      },
    })
    const alternate = Theme.extend(base, {
      typography: { heading: { 32: { fontSize: '36px', lineHeight: '44px' } } },
    })
    const styles = Style.define(
      {
        title: {
          fontWeight: 500,
          typography: 'heading.32',
          ':hover': { fontWeight: 700 },
        },
        mono: { typography: 'label.14.mono' },
        responsive: {
          typography: 'heading.32',
          '@media (min-width: 800px)': { typography: 'label.14' },
        },
        important: { typography: 'heading.32 !important' },
      },
      { vars: base },
    )
    const output = Css.compile({ styles, vars: { alternate, base } })
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage({
        viewport: { width: 600, height: 400 },
      })
      await page.setContent(
        `<style>${output.css}</style><main class="${output.vars.base}"><p id="title" class="${output.classes.title}">Title</p><p id="mono" class="${output.classes.mono}">Mono</p><p id="responsive" class="${output.classes.responsive}">Responsive</p><p id="important" style="font-size:10px" class="${output.classes.important}">Important</p></main>`,
      )

      expect(
        await page
          .locator('#title')
          .evaluate((element) => getComputedStyle(element).fontSize),
      ).toMatchInlineSnapshot(`"32px"`)
      expect(
        await page
          .locator('#title')
          .evaluate((element) => getComputedStyle(element).fontWeight),
      ).toMatchInlineSnapshot(`"500"`)
      expect(
        await page
          .locator('#title')
          .evaluate((element) => getComputedStyle(element).lineHeight),
      ).toMatchInlineSnapshot(`"40px"`)
      expect(
        await page
          .locator('#title')
          .evaluate((element) => getComputedStyle(element).letterSpacing),
      ).toMatchInlineSnapshot(`"-1.28px"`)
      expect(
        await page
          .locator('#mono')
          .evaluate((element) => getComputedStyle(element).fontFamily),
      ).toMatchInlineSnapshot(`""Geist Mono""`)
      expect(
        await page
          .locator('#important')
          .evaluate((element) => getComputedStyle(element).fontSize),
      ).toMatchInlineSnapshot(`"32px"`)

      await page.locator('#title').hover()
      expect(
        await page
          .locator('#title')
          .evaluate((element) => getComputedStyle(element).fontWeight),
      ).toMatchInlineSnapshot(`"700"`)
      await page
        .locator('main')
        .evaluate(
          (element, className) => element.setAttribute('class', className),
          output.vars.alternate,
        )
      expect(
        await page
          .locator('#title')
          .evaluate((element) => getComputedStyle(element).fontSize),
      ).toMatchInlineSnapshot(`"36px"`)
      expect(
        await page
          .locator('#title')
          .evaluate((element) => getComputedStyle(element).lineHeight),
      ).toMatchInlineSnapshot(`"44px"`)
      await page.setViewportSize({ width: 900, height: 400 })
      expect(
        await page
          .locator('#responsive')
          .evaluate((element) => getComputedStyle(element).fontSize),
      ).toMatchInlineSnapshot(`"14px"`)
    } finally {
      await browser.close()
    }
  })

  test('compiles typography fields into native tables with font mappings', () => {
    const theme = Theme.define({
      typography: {
        heading: {
          32: {
            fontFamily: 'Geist',
            fontSize: '32px',
            fontWeight: 600,
            letterSpacing: '-1.28px',
            lineHeight: '40px',
          },
        },
      },
    })
    const alternate = Theme.extend(theme, {
      typography: { heading: { 32: { fontSize: '36px' } } },
    })
    const output = StyleSheet.compile({
      fonts: { Geist: 'Geist-Native' },
      styles: Style.define(
        { title: { typography: 'heading.32', fontWeight: 500 } },
        { vars: theme },
      ),
      vars: { alternate, base: theme },
    })

    expect(output.styles.base.light.title).toMatchInlineSnapshot(`
      {
        "fontFamily": "Geist-Native",
        "fontSize": 32,
        "fontWeight": 500,
        "letterSpacing": -1.28,
        "lineHeight": 40,
      }
    `)
    expect(output.styles.alternate.light.title.fontSize).toMatchInlineSnapshot(
      `36`,
    )
  })

  test('retains typography sets through packed configurations and recipe compilation', () => {
    const library = Graph.compile({
      modules: {
        'theme.ts':
          "import {Config} from 'zyzz';export const {style,vars:theme,variants}=Config.create({vars:{typography:{copy:{14:{fontSize:'14px',fontWeight:400,lineHeight:'20px'}}}}});",
      },
    })
    const contract = library.contracts['theme.ts']!
    expect(JSON.parse(contract).version).toMatchInlineSnapshot(`28`)

    expect(() =>
      Graph.compile({
        contracts: {
          'library.js': JSON.stringify({
            ...JSON.parse(contract),
            version: 23,
          }),
        },
        imports: { 'app.ts': { library: 'library.js', zyzz: null } },
        modules: {
          'app.ts': `import {style} from 'library';export const body=style({typography:'copy.14'});`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: library.js:0: Invalid library contract: Vars contracts require contract version 26 or later.]`,
    )

    const consumer = Graph.compile({
      contracts: { 'library.js': contract },
      imports: { 'app.ts': { library: 'library.js', zyzz: null } },
      modules: {
        'app.ts': `import {style,theme,variants} from 'library';export const body=style({typography:'copy.14'});export const strong=style({fontWeight:theme.typography.copy[14].fontWeight});export const text=variants({base:{typography:'copy.14'},variants:{strong:{true:{fontWeight:550}}}});`,
      },
    })

    expect(consumer.modules['app.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1xn44ix111xh3v-style-theme{--z-t1xn44ix111xh3v-style-typography_2e_copy_2e_14_2e_fontSize:14px;--z-t1xn44ix111xh3v-style-typography_2e_copy_2e_14_2e_fontWeight:400;--z-t1xn44ix111xh3v-style-typography_2e_copy_2e_14_2e_lineHeight:20px;}
      .z-font-size-Oi_QYm-0{font-size:var(--z-t1xn44ix111xh3v-style-typography_2e_copy_2e_14_2e_fontSize,14px);}
      .z-font-weight-xWS6L8-1{font-weight:var(--z-t1xn44ix111xh3v-style-typography_2e_copy_2e_14_2e_fontWeight,400);}
      .z-line-height-NiWjJz-2{line-height:var(--z-t1xn44ix111xh3v-style-typography_2e_copy_2e_14_2e_lineHeight,20px);}
      .z-font-weight-qIDn1A-0{font-weight:var(--z-t1xn44ix111xh3v-style-typography_2e_copy_2e_14_2e_fontWeight,400);}
      .z-font-size-lLWBdR-0{font-size:var(--z-t1xn44ix111xh3v-style-typography_2e_copy_2e_14_2e_fontSize,14px);}
      .z-font-weight-6BAxVw-1{font-weight:var(--z-t1xn44ix111xh3v-style-typography_2e_copy_2e_14_2e_fontWeight,400);}
      .z-line-height-9Wx-s3-2{line-height:var(--z-t1xn44ix111xh3v-style-typography_2e_copy_2e_14_2e_lineHeight,20px);}
      .z-font-weight-G4wOi6-3{&:where([data-strong="true"]){font-weight:550;}}"
    `)
  })

  test.each(['heading', 'heading.32.fontSize', 'heading.48', ['heading.32']])(
    'rejects unknown typography set %j',
    (typography) => {
      const theme = Theme.define({
        typography: { heading: { 32: { fontSize: '32px' } } },
      })
      expect(() =>
        Style.define({ title: { typography } } as never, { vars: theme }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Style.InvalidError: ["title","typography"]: Expected a named typography set from the bound theme.]`,
      )
    },
  )

  test('bound authoring requires an explicit identity without compilation', () => {
    const theme = Theme.define(tokens)

    expect(() => theme.className).toThrowErrorMatchingInlineSnapshot(
      `[style.MissingTransformError: style requires a compile-time transform. Source extraction alone does not rewrite calls; do not execute untransformed authoring source.]`,
    )

    const { style } = theme

    expect(() =>
      style({ color: 'brand', padding: 'md' }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Theme.define requires an explicit id without the compiler plugin.]`,
    )
    expect(Object.isFrozen(theme)).toMatchInlineSnapshot('true')
  })

  test('annotated token records compile with omitted optional groups', () => {
    const input: Theme.Tokens = { color: { brand: '#fff' }, spacing: undefined }
    const theme = Theme.define(input)
    const reference = theme.tokens.color!.brand as Theme.Reference<'color'>
    const output = Css.compile({
      styles: Style.define({ card: { color: reference } }),
      vars: { base: theme },
    })

    expect(output.css).toMatchInlineSnapshot(`
      ".t_0{--z0:#fff;}
      .z-text-bJfYby{color:var(--z0,#fff);}"
    `)
  })

  test('escaped identifiers preserve independent styles and scoped palettes in Chromium', async () => {
    const base = Theme.define({
      color: { brand: { primary: '#fff' }, brand_2e_primary: '#000' },
    })
    const alternate = Theme.extend(base, {
      color: { brand: { primary: '#06c' }, brand_2e_primary: '#f00' },
    })

    const output = Css.compile({
      composition: 'independent',
      styles: Style.define({
        other: { color: base.tokens.color.brand_2e_primary },
        t_0: { color: '#175' },
        'z_theme-base': { color: base.tokens.color.brand.primary },
      }),
      vars: { base, 'foo.bar': alternate, foo_2e_bar: base },
    })

    expect(output.classes).toMatchInlineSnapshot(`
      {
        "other": "z-text-JqClw3-0",
        "t_0": "z-text-4iVqd5-0",
        "z_theme-base": "z-text-SnBR4v-0",
      }
    `)
    expect(output.css).toMatchInlineSnapshot(`
      ".t_0{--z0:#000;--z1:#fff;}
      .t_1{--z0:#f00;--z1:#06c;}
      .t_2{--z0:#000;--z1:#fff;}
      .z-text-JqClw3-0{color:var(--z0,#000);}
      .z-text-4iVqd5-0{color:#175;}
      .z-text-SnBR4v-0{color:var(--z1,#fff);}"
    `)
    expect(output.vars).toMatchInlineSnapshot(`
      {
        "base": "t_0",
        "foo.bar": "t_1",
        "foo_2e_bar": "t_2",
      }
    `)

    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()

      await page.setContent(`<style>${output.css}</style>
        <section class="${output.vars['foo.bar']}">
          <div id="nested" class="${output.classes['z_theme-base']}"></div>
          <div id="escaped" class="${output.classes.other}"></div>
          <div id="collision" class="${output.classes.t_0}"></div>
        </section>
        <section class="${output.vars.foo_2e_bar}"><div id="base" class="${output.classes['z_theme-base']}"></div></section>`)

      expect(
        await page
          .locator('#nested')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot('"rgb(0, 102, 204)"')
      expect(
        await page
          .locator('#escaped')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot('"rgb(255, 0, 0)"')
      expect(
        await page
          .locator('#collision')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot('"rgb(17, 119, 85)"')
      expect(
        await page
          .locator('#base')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot('"rgb(255, 255, 255)"')
    } finally {
      await browser.close()
    }
  })

  test('portable references compile to live variables and defining fallbacks', () => {
    const theme = Theme.define(tokens)
    const independent = Theme.define(tokens)

    const styles = Style.define({
      button: {
        backgroundColor: theme.tokens.backgroundColor.surface,
        color: theme.tokens.color.brand,
        padding: theme.tokens.spacing.md,
      },
      independent: { color: independent.tokens.color.brand },
    })

    const result = Css.compile({ styles, vars: { base: theme, independent } })

    expect(result.css).toMatchInlineSnapshot(`
      ".t_0{--z0:light-dark(#fff,#111);--z1:#06c;--z2:8px;}
      .t_1{--z3:#06c;}
      .z-bg-lyZQGr{background-color:var(--z0,light-dark(#fff,#111));}
      .z-text-hGV2TL-1{color:var(--z1,#06c);}
      .z-p-B1LbZi{padding:var(--z2,8px);}
      .z-text-AbT2X3-0{color:var(--z3,#06c);}"
    `)
    expect(result.classes).toMatchInlineSnapshot(`
      {
        "button": "z-bg-lyZQGr z-text-hGV2TL-1 z-p-B1LbZi",
        "independent": "z-text-AbT2X3-0",
      }
    `)
    expect(result.vars).toMatchInlineSnapshot(`
      {
        "base": "t_0",
        "independent": "t_1",
      }
    `)
    expect(Css.compile({ styles }).css).toMatchInlineSnapshot(`
      ".z-bg-lyZQGr{background-color:var(--z0,light-dark(#fff,#111));}
      .z-text-hGV2TL-1{color:var(--z1,#06c);}
      .z-p-B1LbZi{padding:var(--z2,8px);}
      .z-text-AbT2X3-0{color:var(--z3,#06c);}"
    `)
    expect(Css.compile({ styles, vars: { independent, renamed: theme } }).css)
      .toMatchInlineSnapshot(`
        ".t_0{--z3:#06c;}
        .t_1{--z0:light-dark(#fff,#111);--z1:#06c;--z2:8px;}
        .z-bg-lyZQGr{background-color:var(--z0,light-dark(#fff,#111));}
        .z-text-hGV2TL-1{color:var(--z1,#06c);}
        .z-p-B1LbZi{padding:var(--z2,8px);}
        .z-text-AbT2X3-0{color:var(--z3,#06c);}"
      `)
    expect(Object.isFrozen(theme.tokens.spacing.md)).toMatchInlineSnapshot(
      'true',
    )
    expect(Object.keys(theme)).toMatchInlineSnapshot(`
      [
        "className",
        "style",
        "tokens",
        "variants",
        "vars",
      ]
    `)
  })

  test('theme scopes stay distinct from authored style names', () => {
    const theme = Theme.define(tokens)
    const styles = Style.define({
      'theme-base': { color: theme.tokens.color.brand },
    })

    expect(Css.compile({ styles, vars: { base: theme } }).css)
      .toMatchInlineSnapshot(`
        ".t_0{--z0:#06c;}
        .z-text-gsB0EO{color:var(--z0,#06c);}"
      `)
  })

  test('invalid authoring fails before CSS can be emitted without reading accessors', () => {
    const invalid = [
      { color: { brand: { light: '#fff' } } },
      { color: { brand: { dark: '#000', light: '#fff', system: '#ccc' } } },
      { color: { 'blue.500': '#fff' } },
      { color: {} },
    ]

    for (const input of invalid) {
      let error: unknown

      try {
        const theme = Reflect.apply(Theme.define, undefined, [
          input,
        ]) as Theme.Definition

        Css.compile({ styles: Style.define({}), vars: { base: theme } })
      } catch (cause) {
        error = cause
      }

      expect(error instanceof Theme.InvalidError).toMatchInlineSnapshot('true')
    }

    let reads = 0

    const input = {
      color: {
        get brand() {
          reads++

          return '#fff' as const
        },
      },
    }

    expect(() => Theme.define(input)).toThrowErrorMatchingInlineSnapshot(
      `[Theme.InvalidError: ["color"]: Expected nonempty keys without dots and enumerable data properties.]`,
    )
    expect(reads).toMatchInlineSnapshot('0')
  })
})

describe('extend', () => {
  test('object-shaped length overrides fail at the public boundary', () => {
    const theme = Theme.define({ spacing: { md: '1lh' } })

    expect(() =>
      Theme.extend(theme, { spacing: { md: {} } } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Theme.InvalidError: ["spacing","md"]: A token leaf cannot become a palette.]`,
    )
    expect(() =>
      Theme.extend(theme, { spacing: { md: [] } } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Theme.InvalidError: ["spacing","md"]: Expected a plain data record.]`,
    )
    expect(() =>
      Theme.extend(theme, { spacing: { md: () => '2rem' } } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Theme.InvalidError: ["spacing","md"]: Expected a plain data record.]`,
    )
  })

  test('undefined override leaves fail while omitted leaves inherit', () => {
    const theme = Theme.define({
      color: { brand: '#06c' },
      spacing: { md: '1lh' },
    })
    const alternate = Theme.extend(theme, { color: { brand: '#fff' } })
    const styles = Style.define({ card: { padding: theme.tokens.spacing.md } })

    expect(Css.compile({ styles, vars: { alternate, base: theme } }).css)
      .toMatchInlineSnapshot(`
        ".t_0{--z0:1lh;}
        .t_1{--z0:1lh;}
        .z-p-SVcDu8{padding:var(--z0,1lh);}"
      `)
    expect(() =>
      Theme.extend(theme, { spacing: { md: undefined } } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Theme.InvalidError: ["spacing","md"]: Expected a plain data record.]`,
    )
    expect(() =>
      Theme.extend(theme, { color: { brand: undefined } } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Theme.InvalidError: ["color","brand"]: Expected a plain data record.]`,
    )
  })

  test('compatible overrides retain identities and reset every live inherited value', () => {
    const input = {
      color: { blue: { 500: '#06c' } },
      spacing: { md: '8px' },
    } as const
    const theme = Theme.define(input)
    const alternate = Theme.extend(theme, { color: { blue: { 500: '#f00' } } })
    const nested = Theme.extend(alternate, { spacing: { md: '12px' } })

    const styles = Style.define({
      button: {
        color: theme.tokens.color.blue[500],
        padding: theme.tokens.spacing.md,
      },
    })

    expect(
      Css.compile({ styles, vars: { alternate, base: theme, nested } }).css,
    ).toMatchInlineSnapshot(`
      ".t_0{--z0:#f00;--z1:8px;}
      .t_1{--z0:#06c;--z1:8px;}
      .t_2{--z0:#f00;--z1:12px;}
      .z-text-gsB0EO{color:var(--z0,#06c);}
      .z-p-Fm87Na{padding:var(--z1,8px);}"
    `)
    expect(
      Css.compile({
        styles: Style.define({
          button: { color: alternate.tokens.color.blue[500] },
        }),
      }).css,
    ).toMatchInlineSnapshot(`".z-text-3RFK8y{color:var(--z0,#f00);}"`)
    expect(input).toMatchInlineSnapshot(`
      {
        "color": {
          "blue": {
            "500": "#06c",
          },
        },
        "spacing": {
          "md": "8px",
        },
      }
    `)
    expect(() =>
      Reflect.apply(Theme.extend, undefined, [
        theme,
        { color: { blue: { 600: '#fff' } } },
      ]),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Theme.InvalidError: ["color","blue","600"]: Extensions cannot add token paths.]`,
    )
    expect(() =>
      Reflect.apply(Theme.extend, undefined, [
        theme,
        { spacing: { md: { extra: '2px' } } },
      ]),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Theme.InvalidError: ["spacing","md"]: A token leaf cannot become a palette.]`,
    )
  })

  test('scopes and preferred schemes render independently in Chromium', async () => {
    const theme = Theme.define(tokens)
    const alternate = Theme.extend(theme, {
      backgroundColor: { surface: { dark: '#222', light: '#eee' } },
      spacing: { md: '16px' },
    })
    const nested = Theme.extend(theme, { color: { brand: '#f00' } })

    const styles = Style.define({
      button: {
        backgroundColor: theme.tokens.backgroundColor.surface,
        color: theme.tokens.color.brand,
        padding: theme.tokens.spacing.md,
      },
    })

    const output = Css.compile({
      styles,
      vars: { alternate, base: theme, nested },
    })
    const browser = await chromium.launch()

    try {
      const page = await browser.newPage({ colorScheme: 'light' })

      await page.setContent(`<style>:root{color-scheme:light dark}${output.css}</style>
        <div id="fallback" class="${output.classes.button}"></div>
        <section class="${output.vars.alternate}">
          <div id="alternate" class="${output.classes.button}"></div>
          <section class="${output.vars.nested}"><div id="nested" class="${output.classes.button}"></div></section>
          <div id="forced" style="color-scheme:dark" class="${output.classes.button}"></div>
        </section>`)

      async function read(id: string) {
        return page.locator(`#${id}`).evaluate((element) => {
          const style = getComputedStyle(element)

          return {
            backgroundColor: style.backgroundColor,
            color: style.color,
            padding: style.padding,
          }
        })
      }

      expect(await read('fallback')).toMatchInlineSnapshot(`
        {
          "backgroundColor": "rgb(255, 255, 255)",
          "color": "rgb(0, 102, 204)",
          "padding": "8px",
        }
      `)
      expect(await read('alternate')).toMatchInlineSnapshot(`
        {
          "backgroundColor": "rgb(238, 238, 238)",
          "color": "rgb(0, 102, 204)",
          "padding": "16px",
        }
      `)
      expect(await read('nested')).toMatchInlineSnapshot(`
        {
          "backgroundColor": "rgb(255, 255, 255)",
          "color": "rgb(255, 0, 0)",
          "padding": "8px",
        }
      `)
      expect(await read('forced')).toMatchInlineSnapshot(`
        {
          "backgroundColor": "rgb(34, 34, 34)",
          "color": "rgb(0, 102, 204)",
          "padding": "16px",
        }
      `)

      await page.emulateMedia({ colorScheme: 'dark' })

      expect(await read('fallback')).toMatchInlineSnapshot(`
        {
          "backgroundColor": "rgb(17, 17, 17)",
          "color": "rgb(0, 102, 204)",
          "padding": "8px",
        }
      `)
      expect(await read('nested')).toMatchInlineSnapshot(`
        {
          "backgroundColor": "rgb(17, 17, 17)",
          "color": "rgb(255, 0, 0)",
          "padding": "8px",
        }
      `)
    } finally {
      await browser.close()
    }
  })
})

describe('queries', () => {
  describe('compile', () => {
    test('preserves dashed and non-ASCII container identifiers', () => {
      expect(() =>
        Theme.define({ containerNames: ['--sidebar', '-sidebar', '侧栏'] }),
      ).not.toThrow()
    })
    test('retains query groups in packed configuration options', () => {
      const result = Graph.compile({
        modules: {
          'config.ts':
            'import {Config,Vars} from "zyzz"; const theme=Vars.define({breakpoint:{tablet:"48rem"},container:{card:"24rem"},containerNames:["sidebar"]}); export const zyzz=Config.create({vars:theme})',
        },
      })

      expect(
        JSON.parse(result.contracts['config.ts']!).version,
      ).toMatchInlineSnapshot(`28`)
      expect(JSON.parse(result.contracts['config.ts']!).exports.zyzz.options)
        .toMatchInlineSnapshot(`
          {
            "theme": {
              "breakpoint": {
                "tablet": "48rem",
              },
              "container": {
                "card": "24rem",
              },
              "containerNames": [
                "sidebar",
              ],
            },
          }
        `)
    })
    test('resolves numeric scale names and preserves typography palette keys', () => {
      const theme = Theme.define({
        fontSize: { '2xl': '1.5rem' },
        borderRadius: { '2xl': '1rem' },
      })

      expect(
        Css.compile({
          styles: Style.define(
            { body: { fontSize: '2xl', borderRadius: '2xl' } },
            { vars: theme },
          ),
        }).css,
      ).toMatchInlineSnapshot(
        `
      ".z-font-size-pT9O1S{font-size:var(--z0,1.5rem);}
      .z-border-radius-EaHYnW{border-radius:var(--z1,1rem);}"
    `,
      )
    })
    test('keeps generated bundled values synchronized', async () => {
      const source = await Fs.readFile(
        new URL('./default.ts', import.meta.url),
        'utf8',
      )
      const result = Graph.compile({ modules: { 'default.ts': source } })
      const contract = JSON.parse(result.contracts['default.ts']!)
      const { containerNames: _, ...generated } = Object.values(
        contract.themes as Record<string, { tokens: Record<string, unknown> }>,
      )[0]!.tokens
      expect(
        Util.isDeepStrictEqual(generated, contextTokens),
      ).toMatchInlineSnapshot(`true`)
    })
    test('links bundled source through its exported style boundary', async () => {
      const source = await Fs.readFile(
        new URL('./default.ts', import.meta.url),
        'utf8',
      )

      const output = Graph.compile({
        modules: {
          'default.ts': source,
          'app.ts':
            'import {style} from "./default.js"; export const body=style({fontFamily:"sans",fontSize:"base",color:"blue.500"})()',
        },
      })

      expect(output.modules['app.ts']!.css).toMatchInlineSnapshot(`
        ".z_theme-26ntzho2pyyt-config-theme{--z-t26ntzho2pyyt-config-fontFamily_2e_sans:Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";--z-t26ntzho2pyyt-config-fontSize_2e_base:1rem;--z-t26ntzho2pyyt-config-color_2e_blue_2e_500:light-dark(#99ceff,#0a4380);}
        .z_scheme-dark{color-scheme:dark;}
        .z_scheme-light{color-scheme:light;}
        .z_scheme-light-dark{color-scheme:light dark;}
        .z-font-family-GS_mYx{font-family:var(--z-t26ntzho2pyyt-config-fontFamily_2e_sans,Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji");}
        .z-font-size-WS5zHH{font-size:var(--z-t26ntzho2pyyt-config-fontSize_2e_base,1rem);}
        .z-text-wudS4h{color:var(--z-t26ntzho2pyyt-config-color_2e_blue_2e_500,light-dark(#99ceff,#0a4380));}"
      `)

      const built = await Esbuild.build({
        stdin: {
          contents: 'import * as root from "zyzz/compiler"; console.log(root)',
          resolveDir: import.meta.dirname,
        },
        bundle: true,
        platform: 'node',
        external: ['oxc-parser', 'lightningcss'],
        write: false,
        metafile: true,
        conditions: ['src'],
      })

      expect(
        Object.keys(built.metafile!.inputs).some((path) =>
          /(?:^|[/\\])(?:src|dist)[/\\]default\.[cm]?[jt]s$/.test(path),
        ),
      ).toMatchInlineSnapshot(`false`)
    })
    test('rejects sparse and accessor container identities', () => {
      const sparse: string[] = []

      sparse.length = 1

      expect(() => Theme.define({ containerNames: sparse })).toThrow(
        Theme.InvalidError,
      )

      let invoked = false

      const names = Object.defineProperty([], '0', {
        get() {
          invoked = true

          return 'card'
        },
      })

      expect(() => Theme.define({ containerNames: names })).toThrow(
        Theme.InvalidError,
      )
      expect(invoked).toMatchInlineSnapshot(`false`)
    })
    test('emits typography variables without emitting threshold variables', () => {
      const theme = Theme.define({
        breakpoint: { tablet: '48rem' },
        container: { card: '24rem' },
        containerNames: ['sidebar'],
        fontSize: { body: '1rem' },
        fontWeight: { medium: 500 },
      })

      const alternate = Theme.extend(theme, {
        breakpoint: { tablet: '50rem' },
        fontSize: { body: '1.25rem' },
      })

      const styles = Style.define({
        body: {
          fontSize: theme.tokens.fontSize.body,
          fontWeight: theme.tokens.fontWeight.medium,
        },
      })

      const output = Css.compile({ styles, vars: { base: theme, alternate } })

      expect(output.css).toMatchInlineSnapshot(`
        ".t_0{--z0:1rem;--z1:500;}
        .t_1{--z0:1.25rem;--z1:500;}
        .z-font-size-kdtzCc{font-size:var(--z0,1rem);}
        .z-font-weight-hMXM99{font-weight:var(--z1,500);}"
      `)
      expect(Object.keys(theme.vars)).toMatchInlineSnapshot(`
      [
        "fontSize",
        "fontWeight",
      ]
    `)
    })
    test('retains query metadata in packed contracts', () => {
      const library = Graph.compile({
        modules: {
          'theme.ts':
            'import {Vars} from "zyzz"; export const theme=Vars.define({breakpoint:{tablet:"48rem"},fontSize:{body:"1rem"}})',
        },
      })

      const packed = library.contracts['theme.ts']!

      expect(packed.includes('48rem')).toMatchInlineSnapshot(`true`)

      const consumer = Graph.compile({
        contracts: { 'library.js': packed },
        imports: { 'app.ts': { library: 'library.js', zyzz: null } },
        modules: {
          'app.ts':
            'import {Config} from "zyzz"; import {theme} from "library"; const config=Config.create({vars:theme}); export const body=config.style({fontSize:"body"})()',
        },
      })

      expect(consumer.modules['app.ts']!.css).toMatchInlineSnapshot(`
        ".z_theme-1xn44ix111xh3v-theme{--z-t1xn44ix111xh3v-theme-fontSize_2e_body:1rem;}
        .z_theme-1e8a67z1uaws1j-config-theme{--z-t1e8a67z1uaws1j-config-fontSize_2e_body:1rem;}
        .z-font-size-tf-SY6{font-size:var(--z-t1e8a67z1uaws1j-config-fontSize_2e_body,1rem);}"
      `)
    })
    test('Chromium applies bundled typography and Geist colors across schemes', async () => {
      const styles = Style.define({
        body: {
          fontSize: bundled.fontSize.base,
          color: bundled.color.foreground,
        },
      })

      const output = Css.compile({ styles, vars: { base: bundled } })
      const browser = await chromium.launch()

      try {
        const page = await browser.newPage()

        await page.setContent(
          `<style>${output.css}</style><div class="${output.vars.base}" style="color-scheme:light"><p id="body" class="${output.classes.body}">Text</p></div>`,
        )

        expect(
          await page
            .locator('#body')
            .evaluate((element) => getComputedStyle(element).fontSize),
        ).toMatchInlineSnapshot(`"16px"`)
        expect(
          await page
            .locator('#body')
            .evaluate((element) => getComputedStyle(element).color),
        ).toMatchInlineSnapshot(`"rgb(23, 23, 23)"`)

        await page
          .locator('#body')
          .evaluate(
            (element) => (element.parentElement!.style.colorScheme = 'dark'),
          )

        expect(
          await page
            .locator('#body')
            .evaluate((element) => getComputedStyle(element).color),
        ).toMatchInlineSnapshot(`"rgb(237, 237, 237)"`)
      } finally {
        await browser.close()
      }
    })
    test('compiles the opt-in bundled typography and palette', () => {
      const styles = Style.define({
        body: {
          color: bundled.color.foreground,
          fontFamily: bundled.fontFamily.sans,
          fontSize: bundled.fontSize.base,
          padding: bundled.spacing[4],
        },
      })

      const output = Css.compile({ styles, vars: { default: bundled } })

      expect(output.css).toMatchInlineSnapshot(`
        ".t_0{--z0:light-dark(#171717,#ededed);--z1:Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";--z2:1rem;--z3:1rem;}
        .z-text-CZyri6{color:var(--z0,light-dark(#171717,#ededed));}
        .z-font-family-9aYERC{font-family:var(--z1,Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji");}
        .z-font-size-4nuiGJ{font-size:var(--z2,1rem);}
        .z-p-3OsuE-{padding:var(--z3,1rem);}"
      `)
      expect(contextTokens.breakpoint.md).toMatchInlineSnapshot(`"48rem"`)
    })
    test.each([
      '"-1px"',
      '"50%"',
      '20',
      '"var(--screen)"',
      '{light:"1px",dark:"2px"}',
    ])('rejects invalid threshold %s', (value) => {
      expect(() =>
        Transform.compile({
          moduleId: 'invalid.ts',
          source: `import {Vars} from "zyzz"; const theme=Vars.define({breakpoint:{tablet:${value}}})`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: invalid.ts:39: ["breakpoint","tablet"]: Expected a named nonnegative length threshold.]`,
      )
    })
  })

  describe('define', () => {
    test('preserves typography palette and exponent threshold keys', () => {
      expect(
        Theme.define({
          fontWeight: { body: { light: 300, bold: 700 } },
          container: { screen: '1e3px' },
        }).tokens.fontWeight.body.light.value,
      ).toMatchInlineSnapshot(`300`)
    })
  })
})
