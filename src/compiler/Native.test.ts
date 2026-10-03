/** Exercises shared authoring through native code generation and real module execution. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Util from 'node:util'
import * as Esbuild from 'esbuild'
import * as Parser from 'oxc-parser'
import * as Trace from '@jridgewell/trace-mapping'
import * as Ds from '../../test/fixtures/native/Ds.js'
import * as Packed from '../../test/fixtures/Packed.js'
import * as Playwright from 'playwright'
import * as Vm from 'node:vm'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Native, Transform } from 'zyzz/compiler'
import { StyleSheet } from 'zyzz/react-native'
import { Native as Runtime } from 'zyzz/runtime'

const source = `import {variants,style,cx as mix} from 'zyzz';
export const card=variants({
  base:{fontSize:'10px',lineHeight:1.5,opacity:0.2},
  variants:{size:{small:{fontSize:'12px'},large:{fontSize:'20px'}},active:{true:{opacity:0.5},false:{opacity:0.8}}},
  defaultVariants:{size:'small',active:false},
  compoundVariants:[{when:{size:'large',active:true},style:{targets:{native:{transform:[{scale:2}]},ios:{opacity:0.7}}}}],
});
const overlay=style({opacity:0.9});
export const compose=(active:boolean)=>mix(card({size:'large',active:true}),active&&overlay());
export function shadow(mix:(value:number)=>number){return mix(2)}
`

async function execute(code: string) {
  const result = await Esbuild.build({
    stdin: { contents: code, loader: 'ts', resolveDir: process.cwd() },
    alias: {
      zyzz: `${process.cwd()}/src/index.ts`,
      'zyzz/runtime': `${process.cwd()}/src/runtime/index.ts`,
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
  })
  return (await import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0]!.text).toString('base64')}`
  )) as {
    results: unknown
    card: Runtime.Callable<{
      size: readonly ['small', 'large']
      active: readonly ['true', 'false']
    }>
    compose: (active: boolean) => Runtime.Props
    shadow: (fn: (value: number) => number) => number
  }
}

describe('compile', () => {
  test('retains deferred errors for mixed supported and unsupported variable conditions', () => {
    const output = Native.compile({
      colorScheme: 'light',
      contextual: true,
      moduleId: 'mixed.ts',
      source: `import {Vars} from 'zyzz';import {useVars} from 'zyzz/react-native/react';
        const vars=Vars.define({spacing:{gap:{default:'2px','@media (width >= 768px)':'4px','@media (hover: hover)':'8px'}}});
        export function read(){return useVars(vars)}`,
    })

    expect(
      output.code.includes('Media-conditioned variables require a web target.'),
    ).toMatchInlineSnapshot(`true`)
  })

  test('omits responsive recipes from static metadata', () => {
    const output = Native.compile({
      colorScheme: 'light',
      contextual: true,
      moduleId: 'responsive-metadata.ts',
      source: `import {style} from 'zyzz';export const panel=style({opacity:0.2,'@media (width >= 768px)':{opacity:0.8}});`,
    })

    expect(output.recipes).toMatchInlineSnapshot(`{}`)
    expect(output.code.includes('.responsive(')).toMatchInlineSnapshot(`true`)
  })

  test('preserves native media endpoints, boolean conditions, and authored precedence', async () => {
    const output = Native.compile({
      colorScheme: 'light',
      contextual: true,
      moduleId: 'ranges.ts',
      source: `import {style} from 'zyzz';import {NativeContext} from 'zyzz/runtime';
        const range=style({opacity:0.1,'@media (400px <= width < 768px)':{opacity:0.2},'@media (min-width: 768px) and (max-height: 600px)':{opacity:0.3},'@media not (width > 800px)':{paddingTop:'1px'},'@media (orientation: landscape)':{flexDirection:'row'},'@media screen and (width >= 48rem), (height > 1000px)':{marginTop:'2px'}});
        export const results=viewport=>NativeContext.resolve(range,{colorScheme:'light',viewport});`,
      units: { px: 1, rem: 16 },
    })
    const apply = (await execute(output.code)).results as (viewport: {
      height: number
      width: number
    }) => unknown
    expect(apply({ height: 800, width: 399.5 })).toMatchInlineSnapshot(`
      {
        "opacity": 0.1,
        "paddingTop": 1,
      }
    `)
    expect(apply({ height: 800, width: 400 })).toMatchInlineSnapshot(`
      {
        "opacity": 0.2,
        "paddingTop": 1,
      }
    `)
    expect(apply({ height: 800, width: 767.5 })).toMatchInlineSnapshot(`
      {
        "opacity": 0.2,
        "paddingTop": 1,
      }
    `)
    expect(apply({ height: 600, width: 768 })).toMatchInlineSnapshot(`
      {
        "flexDirection": "row",
        "marginTop": 2,
        "opacity": 0.3,
        "paddingTop": 1,
      }
    `)
    expect(apply({ height: 600.5, width: 800 })).toMatchInlineSnapshot(`
      {
        "flexDirection": "row",
        "marginTop": 2,
        "opacity": 0.1,
        "paddingTop": 1,
      }
    `)
    expect(apply({ height: 601, width: 800.5 })).toMatchInlineSnapshot(`
      {
        "flexDirection": "row",
        "marginTop": 2,
        "opacity": 0.1,
      }
    `)
    expect(apply({ height: 1000.5, width: 300 })).toMatchInlineSnapshot(`
      {
        "marginTop": 2,
        "opacity": 0.1,
        "paddingTop": 1,
      }
    `)
  })

  test.each(['ios', 'android'] as const)(
    'executes source and packed responsive variants and calculations on %s',
    async (platform) => {
      const source = await Fs.readFile(
        'test/fixtures/native/responsive/Styles.ts',
        'utf8',
      )
      const publisher = Graph.compile({ modules: { 'library.ts': source } })
      for (const packed of [false, true]) {
        const output = Graph.compile({
          ...(packed ? { contracts: publisher.contracts } : {}),
          imports: {
            'app.ts': {
              './library.js': 'library.ts',
              zyzz: null,
              'zyzz/runtime': null,
            },
            'library.ts': { zyzz: null },
          },
          modules: {
            ...(!packed ? { 'library.ts': source } : {}),
            'app.ts': `import {card,meter,panel} from './library.js';import {cx} from 'zyzz';import {NativeContext} from 'zyzz/runtime';
              const composed=cx(card({expanded:true}),meter({ratio:2}));
              export const results=(wide)=>NativeContext.resolve(wide?composed.style:panel,{colorScheme:'light',viewport:{height:800,width:wide?768:767.5}});`,
          },
          native: { colorScheme: 'light', contextual: true, platform },
        })
        const code = await Packed.bundle({
          entry: 'app.ts',
          modules: {
            ...Object.fromEntries(
              Object.entries(publisher.modules).map(([id, value]) => [
                id,
                value.code,
              ]),
            ),
            ...Object.fromEntries(
              Object.entries(output.modules).map(([id, value]) => [
                id,
                value.code,
              ]),
            ),
          },
        })
        const context = Vm.createContext()
        Vm.runInContext(code, context)
        const apply = Vm.runInContext('Fixture.results', context) as (
          wide: boolean,
        ) => unknown
        expect(apply(false)).toMatchInlineSnapshot(`
          {
            "flexDirection": "column",
            "paddingBottom": 16,
            "paddingLeft": 16,
            "paddingRight": 16,
            "paddingTop": 16,
          }
        `)
        expect(apply(true)).toMatchInlineSnapshot(`
          [
            {
              "opacity": 0.5,
              "paddingBottom": 12,
              "paddingTop": 24,
            },
            {
              "height": 12,
              "width": 48,
            },
          ]
        `)
      }
    },
  )

  test('selects native breakpoints, conditional variables, and scoped callback values together', async () => {
    const source = `import {defineConfig,Vars} from 'zyzz';import {NativeContext} from 'zyzz/runtime';
      const base=Vars.define({breakpoint:{md:'768px'},color:{ink:{light:'#112233',dark:'#334455'}},spacing:{gutter:{default:'16px','@media md':'24px'}}});
      const compact=Vars.extend(base,{spacing:{gutter:{default:'8px','@media md':'12px'}}});
      const {style,vars}=defineConfig({defaultVars:'base',vars:{base,compact}});
      const panel=style((input:{ratio:number})=>({color:'ink',padding:'gutter',width:\`calc(\${vars.spacing.gutter} * \${input.ratio}) !custom\`,flexDirection:'column','@media md':{flexDirection:'row'},'@media (height < 600px)':{display:'none'}}));
      export const results=(viewport,set='base',colorScheme='light')=>NativeContext.resolve(panel,{viewport,set,colorScheme},{ratio:2});`
    const output = Native.compile({
      source,
      moduleId: 'responsive.ts',
      colorScheme: 'light',
      contextual: true,
    })
    const apply = (await execute(output.code)).results as (
      viewport: { height: number; width: number } | undefined,
      set?: string,
      scheme?: string,
    ) => unknown
    expect(apply({ height: 800, width: 767.5 })).toMatchInlineSnapshot(`
      {
        "color": "#112233",
        "flexDirection": "column",
        "paddingBottom": 16,
        "paddingLeft": 16,
        "paddingRight": 16,
        "paddingTop": 16,
        "width": 32,
      }
    `)
    expect(apply({ height: 800, width: 768 })).toMatchInlineSnapshot(`
      {
        "color": "#112233",
        "flexDirection": "row",
        "paddingBottom": 24,
        "paddingLeft": 24,
        "paddingRight": 24,
        "paddingTop": 24,
        "width": 48,
      }
    `)
    expect(apply({ height: 599.5, width: 768.5 }, 'compact', 'dark'))
      .toMatchInlineSnapshot(`
      {
        "color": "#334455",
        "display": "none",
        "flexDirection": "row",
        "paddingBottom": 12,
        "paddingLeft": 12,
        "paddingRight": 12,
        "paddingTop": 12,
        "width": 24,
      }
    `)
    expect(() => apply(undefined)).toThrowErrorMatchingInlineSnapshot(
      `[Error: Native media queries require the native Provider window dimensions.]`,
    )
    expect(() =>
      apply({ height: 800, width: NaN }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Native window dimensions must be finite and nonnegative.]`,
    )
  })

  test('keeps unrelated responsive variables out of empty and static style selections', async () => {
    const output = Native.compile({
      colorScheme: 'light',
      contextual: true,
      moduleId: 'independent.ts',
      source: `import {defineConfig} from 'zyzz';import {NativeContext} from 'zyzz/runtime';
        const {style}=defineConfig({vars:{spacing:{gutter:{default:'8px',${Array.from(
          { length: 9 },
          (_entry, index) => `'@media (width >= ${index}px)':'16px'`,
        ).join(',')}}}}});
        const empty=style();const plain=style({opacity:0.5});
        export const results={empty:NativeContext.resolve(empty,{colorScheme:'light'}),plain:NativeContext.resolve(plain,{colorScheme:'light'})};`,
    })
    const results = (await execute(output.code)).results

    expect(results).toMatchInlineSnapshot(`
      {
        "empty": {},
        "plain": {
          "opacity": 0.5,
        },
      }
    `)
  })

  test('retains ahead-of-time responsive CSS in a real browser', async () => {
    const output = Graph.compile({
      modules: {
        'Styles.ts': await Fs.readFile(
          'test/fixtures/native/responsive/Styles.ts',
          'utf8',
        ),
      },
    })
    const code = await Packed.bundle({
      entry: 'Styles.ts',
      modules: { 'Styles.ts': output.modules['Styles.ts']!.code },
    })
    const browser = await Playwright.chromium.launch()
    try {
      const page = await browser.newPage({
        viewport: { width: 767, height: 800 },
      })
      await page.setContent(
        `<style>${output.sharedCss ?? ''}${output.modules['Styles.ts']!.css}</style><div id="panel"></div>`,
      )
      await page.addScriptTag({
        content: `${code};document.documentElement.className=Fixture.vars().className;document.getElementById('panel').className=Fixture.panel().className;`,
      })
      const read = () =>
        page.locator('#panel').evaluate((element) => {
          const style = getComputedStyle(element)
          return {
            display: style.display,
            flexDirection: style.flexDirection,
            paddingTop: style.paddingTop,
          }
        })
      expect(await read()).toMatchInlineSnapshot(`
        {
          "display": "block",
          "flexDirection": "column",
          "paddingTop": "16px",
        }
      `)
      await page.setViewportSize({ width: 768, height: 600 })
      expect(await read()).toMatchInlineSnapshot(`
        {
          "display": "block",
          "flexDirection": "row",
          "paddingTop": "24px",
        }
      `)
      await page.setViewportSize({ width: 768, height: 599 })
      expect(await read()).toMatchInlineSnapshot(`
        {
          "display": "none",
          "flexDirection": "row",
          "paddingTop": "24px",
        }
      `)
    } finally {
      await browser.close()
    }
  })

  test('rejects unsupported native media instead of selecting defaults', () => {
    expect(() =>
      Native.compile({
        colorScheme: 'light',
        contextual: true,
        moduleId: 'unsupported.ts',
        source: `import {style} from 'zyzz';export const panel=style({'@media (hover: hover)':{opacity:0.5}});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Native.CompileError: Unsupported native media feature.]`,
    )
    expect(() =>
      Native.compile({
        colorScheme: 'light',
        contextual: true,
        moduleId: 'unsupported.ts',
        source: `import {style} from 'zyzz';export const panel=style({'@media (width > 10em)':{opacity:0.5}});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Native.CompileError: Use zero, px, or rem with an explicit rem conversion.]`,
    )
    expect(() =>
      Native.compile({
        colorScheme: 'light',
        contextual: true,
        moduleId: 'unsupported.ts',
        source: `import {style} from 'zyzz';export const panel=style({'@media NOT SCREEN':{opacity:0.5}});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Native.CompileError: Native media types support all or screen without negation.]`,
    )
  })

  test('bounds native media definitions and retains unsupported selector errors', () => {
    expect(() =>
      Native.compile({
        colorScheme: 'light',
        contextual: true,
        moduleId: 'bounded.ts',
        source: `import {style} from 'zyzz';export const panel=style({${Array.from(
          { length: 9 },
          (_entry, index) => `'@media (width >= ${index}px)':{opacity:0.5}`,
        ).join(',')}});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Native.CompileError: Native media supports at most eight distinct conditions per definition.]`,
    )
    expect(() =>
      Native.compile({
        colorScheme: 'light',
        contextual: true,
        moduleId: 'selector.ts',
        source: `import {style} from 'zyzz';export const panel=style({'@media (width >= 768px)':{':hover':{opacity:0.5}}});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[StyleSheet.CompileError: ["style-tgv5db1vvnnmj-46"]: Selectors, queries, and nested rules are not supported on native.]`,
    )
  })

  test('selects live theme calculations for each native scope and scheme', async () => {
    const source = `import {defineConfig} from 'zyzz';import {NativeContext} from 'zyzz/runtime';
      const {style,vars}=defineConfig({vars:{base:{color:{surface:{light:'#112233',dark:'#334455'}},spacing:{panel:'180px',gutter:'80px'}},compact:{color:{surface:{light:'#445566',dark:'#556677'}},spacing:{panel:'120px',gutter:'40px'}}},defaultVars:'base'});
      const artwork=style((input:{ratio:number})=>({backgroundColor:'surface',width:\`calc(\${vars.spacing.panel} * 2 + \${vars.spacing.gutter}) !custom\`,height:\`calc((\${vars.spacing.panel} * 2 + \${vars.spacing.gutter}) / \${input.ratio}) !custom\`}));
      export const results=(set,colorScheme)=>NativeContext.resolve(artwork,{set,colorScheme},{ratio:2});`
    const output = Native.compile({
      source,
      moduleId: 'scoped-calculations.ts',
      colorScheme: 'light',
      contextual: true,
    })
    const apply = (await execute(output.code)).results as (
      set: string,
      scheme: string,
    ) => unknown
    expect(apply('base', 'light')).toMatchInlineSnapshot(`
      {
        "backgroundColor": "#112233",
        "height": 220,
        "width": 440,
      }
    `)
    expect(apply('base', 'dark')).toMatchInlineSnapshot(`
      {
        "backgroundColor": "#334455",
        "height": 220,
        "width": 440,
      }
    `)
    expect(apply('compact', 'dark')).toMatchInlineSnapshot(`
      {
        "backgroundColor": "#556677",
        "height": 140,
        "width": 280,
      }
    `)
  })

  test('converts nested callback calculations, shorthand lengths, and typography together', async () => {
    const source = `import {style} from 'zyzz';
      const box=style((input:{gap:string;ratio:number})=>({width:\`calc(\${input.gap} / \${input.ratio})\`,padding:\`calc(\${input.gap} * 2) 1rem\`,marginLeft:\`calc(\${input.gap} - 10px)\`,fontSize:\`calc(1rem + \${input.gap})\`,lineHeight:1.5}));
      export const results=box({gap:'calc(2px + 2px)',ratio:2});`
    const output = Native.compile({
      source,
      moduleId: 'nested-calculations.ts',
      colorScheme: 'light',
      units: { px: 2, rem: 20 },
    })
    expect((await execute(output.code)).results).toMatchInlineSnapshot(`
      {
        "style": {
          "fontSize": 28,
          "lineHeight": 42,
          "marginLeft": -12,
          "paddingBottom": 16,
          "paddingLeft": 20,
          "paddingRight": 20,
          "paddingTop": 16,
          "width": 4,
        },
      }
    `)
  })

  test('rejects invalid calculated payloads before returning native props', async () => {
    const source = `import {style} from 'zyzz';
      const box=style((input:{gap:string;ratio:number})=>({width:\`calc(\${input.gap} / \${input.ratio})\`}));
      export const results=(gap,ratio)=>box({gap,ratio});`
    const output = Native.compile({
      source,
      moduleId: 'invalid-calculations.ts',
      colorScheme: 'light',
    })
    const apply = (await execute(output.code)).results as (
      gap: string,
      ratio: number,
    ) => unknown
    expect(() => apply('8px', 0)).toThrowErrorMatchingInlineSnapshot(
      `[Error: Native calc requires compatible number and length operands.]`,
    )
    expect(() => apply('8px', -1)).toThrowErrorMatchingInlineSnapshot(
      `[Error: Converted length is outside the native property domain.]`,
    )
    expect(() => apply('calc(8px + 2%)', 1)).toThrowErrorMatchingInlineSnapshot(
      `[Error: Unsupported native calc expression.]`,
    )
    expect(() =>
      apply('calc(8px * 2px)', 1),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Native calc requires compatible number and length operands.]`,
    )
    expect(() => apply('8px', NaN)).toThrowErrorMatchingInlineSnapshot(
      `[Native.SelectionError: Missing or invalid native payload: ratio.]`,
    )
    expect(() => apply('8px', Infinity)).toThrowErrorMatchingInlineSnapshot(
      `[Native.SelectionError: Missing or invalid native payload: ratio.]`,
    )
    expect(() =>
      Reflect.apply(apply, undefined, ['8px', '2']),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Native.SelectionError: Native numeric bindings require numbers.]`,
    )
    expect(() => apply('1rem', 1)).toThrowErrorMatchingInlineSnapshot(
      `[Error: Provide units.rem for rem lengths.]`,
    )
    expect(() => apply('var(--width)', 1)).toThrowErrorMatchingInlineSnapshot(
      `[Error: Unsupported native calc expression.]`,
    )
    expect(() =>
      apply(`calc(${'('.repeat(65)}1px${')'.repeat(65)})`, 1),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Native calc exceeds 64 nested operations.]`,
    )
    expect(() =>
      apply(`calc(${Array.from({ length: 260 }, () => '1px').join(' + ')})`, 1),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Native calc exceeds 512 tokens.]`,
    )
  })

  test.each(['ios', 'android'] as const)(
    'migrates all six Tempro dynamic geometries through source and packed imports on %s',
    async (platform) => {
      const modules = {
        'Dimensions.ts': await Fs.readFile(
          'test/fixtures/native/tempro/Dimensions.ts',
          'utf8',
        ),
        'Styles.ts': await Fs.readFile(
          'test/fixtures/native/tempro/Styles.ts',
          'utf8',
        ),
      }
      const publisher = Graph.compile({ modules })
      const imported = Graph.compile({
        modules,
        native: { colorScheme: 'light', platform },
      })
      const packed = Graph.compile({
        contracts: { 'components/index.js': publisher.contracts['Styles.ts']! },
        imports: { 'app.ts': { components: 'components/index.js' } },
        modules: { 'app.ts': "export * from 'components';" },
        native: { colorScheme: 'light', platform },
      })
      for (const output of [imported, packed]) {
        const code = await Packed.bundle({
          entry: output === packed ? 'app.ts' : 'Styles.ts',
          modules: Object.fromEntries(
            Object.entries(output.modules).map(([id, value]) => [
              id,
              value.code,
            ]),
          ),
          packages: {
            components: {
              'index.js': publisher.modules['Styles.ts']!.code,
              'Dimensions.js': modules['Dimensions.ts'],
            },
          },
        })
        const styles = Vm.runInNewContext(`${code}\nFixture`) as Record<
          string,
          (input: object) => { style: StyleSheet.NativeStyle }
        >
        expect(styles.headerArtwork!({ aspectRatio: 2 }))
          .toMatchInlineSnapshot(`
          {
            "style": {
              "height": 220,
              "position": "absolute",
              "right": 0,
              "top": 0,
              "width": 440,
            },
          }
        `)
        expect(styles.avatarContainer!({ size: 'small' }))
          .toMatchInlineSnapshot(`
          {
            "style": {
              "alignItems": "center",
              "borderBottomLeftRadius": 999,
              "borderBottomRightRadius": 999,
              "borderTopLeftRadius": 999,
              "borderTopRightRadius": 999,
              "height": 40,
              "justifyContent": "center",
              "overflow": "hidden",
              "width": 40,
            },
          }
        `)
        expect(styles.avatarContainer!({ size: 'large' }))
          .toMatchInlineSnapshot(`
          {
            "style": {
              "alignItems": "center",
              "borderBottomLeftRadius": 999,
              "borderBottomRightRadius": 999,
              "borderTopLeftRadius": 999,
              "borderTopRightRadius": 999,
              "height": 68,
              "justifyContent": "center",
              "overflow": "hidden",
              "width": 68,
            },
          }
        `)
        expect(styles.statusContent!({ variant: 'send' }))
          .toMatchInlineSnapshot(`
          {
            "style": {
              "alignItems": "center",
              "flexGrow": 1,
              "justifyContent": "flex-start",
              "paddingTop": 136,
            },
          }
        `)
        expect(styles.statusContent!({ variant: 'default' }))
          .toMatchInlineSnapshot(`
          {
            "style": {
              "alignItems": "center",
              "flexGrow": 1,
              "justifyContent": "flex-start",
              "paddingTop": 16,
            },
          }
        `)
        expect(styles.statusCopy!({ variant: 'send' })).toMatchInlineSnapshot(`
          {
            "style": {
              "alignItems": "center",
              "columnGap": 8,
              "marginTop": 24,
              "paddingLeft": 48,
              "paddingRight": 48,
              "rowGap": 8,
            },
          }
        `)
        expect(styles.statusGraphic!({ variant: 'default' }))
          .toMatchInlineSnapshot(`
          {
            "style": {
              "alignItems": "center",
              "height": 160,
              "justifyContent": "center",
            },
          }
        `)
        expect(styles.statusSymbol!({ variant: 'send' }))
          .toMatchInlineSnapshot(`
          {
            "style": {
              "height": 64,
              "position": "relative",
              "width": 128,
            },
          }
        `)
        expect(
          styles.statusCopy!({ variant: 'default' }).style.columnGap,
        ).toMatchInlineSnapshot(`16`)
        expect(
          styles.statusGraphic!({ variant: 'send' }).style.height,
        ).toMatchInlineSnapshot(`64`)
        expect(
          styles.statusSymbol!({ variant: 'default' }).style.height,
        ).toMatchInlineSnapshot(`120`)
      }
    },
  )

  test('preserves calculated artwork dimensions in a real browser', async () => {
    const output = Graph.compile({
      modules: {
        'Dimensions.ts': await Fs.readFile(
          'test/fixtures/native/tempro/Dimensions.ts',
          'utf8',
        ),
        'Styles.ts': await Fs.readFile(
          'test/fixtures/native/tempro/Styles.ts',
          'utf8',
        ),
      },
    })
    const code = await Packed.bundle({
      entry: 'Styles.ts',
      modules: Object.fromEntries(
        Object.entries(output.modules).map(([id, value]) => [id, value.code]),
      ),
    })
    const browser = await Playwright.chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>${Object.values(output.modules)
          .map((module) => module.css)
          .join('\n')}</style><div id="artwork"></div>`,
      )
      await page.addScriptTag({
        content: `${code};window.applyArtwork = Fixture.headerArtwork;`,
      })
      const dimensions = await page.evaluate(() => {
        const apply = (
          window as unknown as {
            applyArtwork: (input: { aspectRatio: number }) => {
              className: string
              style: Record<string, string>
            }
          }
        ).applyArtwork
        const element = document.getElementById('artwork')!
        const props = apply({ aspectRatio: 2 })
        element.className = props.className
        for (const [name, value] of Object.entries(props.style))
          element.style.setProperty(name, String(value))
        const style = getComputedStyle(element)
        return { width: style.width, height: style.height }
      })
      expect(dimensions).toMatchInlineSnapshot(`
        {
          "height": "220px",
          "width": "440px",
        }
      `)
    } finally {
      await browser.close()
    }
  })

  test('converts custom native font mappings and reports unsupported line heights', async () => {
    const output = Native.compile({
      colorScheme: 'light',
      contextual: true,
      moduleId: 'values.ts',
      fonts: { 'Web Font': 'NativeFont' },
      units: { px: 2 },
      source: `import {Config} from 'zyzz';import {useVars} from 'zyzz/react-native/react';
        const {vars}=Config.create({vars:{font:{body:'Web Font'},typography:{body:{fontSize:'10px',lineHeight:'normal'}}},mappings:{font:['fontFamily']}});
        export function read(){return useVars(vars)}`,
    })
    expect(output.code.includes('NativeFont')).toMatchInlineSnapshot(`true`)
    expect(
      output.code.includes('Unsupported native line height: normal.'),
    ).toMatchInlineSnapshot(`true`)
  })

  test('validates units for modules containing only variable reads', () => {
    expect(() =>
      Native.compile({
        units: { px: 0 },
        colorScheme: 'light',
        contextual: true,
        moduleId: 'values.ts',
        source: `import {Vars} from 'zyzz';import {useVars} from 'zyzz/react-native/react';const vars=Vars.define({spacing:{gap:'2px'}});export function read(){return useVars(vars)}`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[StyleSheet.CompileError: ["units","px"]: Unit scales must be positive finite px or rem conversions.]`,
    )
  })

  test('validates fonts for modules containing only variable reads', () => {
    expect(() =>
      Native.compile({
        fonts: { web: '' },
        colorScheme: 'light',
        contextual: true,
        moduleId: 'values.ts',
        source: `import {Vars} from 'zyzz';import {useVars} from 'zyzz/react-native/react';const vars=Vars.define({spacing:{gap:'2px'}});export function read(){return useVars(vars)}`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[StyleSheet.CompileError: ["fonts","web"]: Font mappings require nonempty family names.]`,
    )
  })

  test('rejects applied web scopes after allowing exported config references', () => {
    expect(() =>
      Graph.compile({
        modules: {
          'config.ts': `import {Config} from 'zyzz';export const {style,vars}=Config.create({vars:{base:{color:{ink:'#000'}},inverse:{color:{ink:'#fff'}}},defaultVars:'base'});`,
          'app.ts': `import {style,vars} from './config.js';export const label=style({color:'ink'});export const scope=vars({set:'inverse'});`,
        },
        native: { colorScheme: 'light', platform: 'ios' },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Native.CompileError: Native static modules do not support CSS contributions, variables, or web set controls.]`,
    )
  })

  test.each(['ios', 'android'] as const)(
    'executes the pinned DS graph and source-free config on %s',
    async (platform) => {
      const modules = await Ds.read()
      const source = `import {style} from './platform/zyzz.config.js';import {NativeContext} from 'zyzz/runtime';
      const surface=style({backgroundColor:'background.primary',padding:'24',borderRadius:'full'});
      const label=style({color:'content.primary',typography:'body.b2'});
      export const result=(set,colorScheme)=>({surface:NativeContext.resolve(surface().style,{set,colorScheme}),label:NativeContext.resolve(label().style,{set,colorScheme})});`
      const native = {
        colorScheme: 'light',
        contextual: true,
        fonts: { 'Pilat, Arial, sans-serif': 'Pilat' },
        platform,
        units: { px: 1, rem: 16 },
      } as const
      const compiled = Graph.compile({
        modules: { ...modules, 'app.ts': source },
        native,
      })
      const code = await Packed.bundle({
        entry: 'app.ts',
        modules: Object.fromEntries(
          Object.entries(compiled.modules).map(([name, value]) => [
            name,
            value.code,
          ]),
        ),
      })
      const app = Vm.runInNewContext(`${code}\nFixture`) as {
        result(set: string, scheme: string): unknown
      }

      expect(app.result('base', 'light')).toMatchInlineSnapshot(`
        {
          "label": {
            "color": "#000000ff",
            "fontFamily": "Pilat",
            "fontSize": 14,
            "fontWeight": 500,
            "letterSpacing": 0.14000000059604645,
            "lineHeight": 20,
          },
          "surface": {
            "backgroundColor": "#f5f5f5ff",
            "borderBottomLeftRadius": 999,
            "borderBottomRightRadius": 999,
            "borderTopLeftRadius": 999,
            "borderTopRightRadius": 999,
            "paddingBottom": 24,
            "paddingLeft": 24,
            "paddingRight": 24,
            "paddingTop": 24,
          },
        }
      `)
      expect(app.result('base', 'dark')).toMatchInlineSnapshot(`
        {
          "label": {
            "color": "#ffffffff",
            "fontFamily": "Pilat",
            "fontSize": 14,
            "fontWeight": 500,
            "letterSpacing": 0.14000000059604645,
            "lineHeight": 20,
          },
          "surface": {
            "backgroundColor": "#000000ff",
            "borderBottomLeftRadius": 999,
            "borderBottomRightRadius": 999,
            "borderTopLeftRadius": 999,
            "borderTopRightRadius": 999,
            "paddingBottom": 24,
            "paddingLeft": 24,
            "paddingRight": 24,
            "paddingTop": 24,
          },
        }
      `)
      expect(app.result('inverse', 'light')).toMatchInlineSnapshot(`
        {
          "label": {
            "color": "#ffffffff",
            "fontFamily": "Pilat",
            "fontSize": 14,
            "fontWeight": 500,
            "letterSpacing": 0.14000000059604645,
            "lineHeight": 20,
          },
          "surface": {
            "backgroundColor": "#000000ff",
            "borderBottomLeftRadius": 999,
            "borderBottomRightRadius": 999,
            "borderTopLeftRadius": 999,
            "borderTopRightRadius": 999,
            "paddingBottom": 24,
            "paddingLeft": 24,
            "paddingRight": 24,
            "paddingTop": 24,
          },
        }
      `)
      expect(app.result('inverse', 'dark')).toMatchInlineSnapshot(`
        {
          "label": {
            "color": "#000000ff",
            "fontFamily": "Pilat",
            "fontSize": 14,
            "fontWeight": 500,
            "letterSpacing": 0.14000000059604645,
            "lineHeight": 20,
          },
          "surface": {
            "backgroundColor": "#f5f5f5ff",
            "borderBottomLeftRadius": 999,
            "borderBottomRightRadius": 999,
            "borderTopLeftRadius": 999,
            "borderTopRightRadius": 999,
            "paddingBottom": 24,
            "paddingLeft": 24,
            "paddingRight": 24,
            "paddingTop": 24,
          },
        }
      `)

      const packed = Graph.compile({ modules })
      const consumer = Graph.compile({
        contracts: {
          'package/config.js': packed.contracts['platform/zyzz.config.ts']!,
        },
        imports: {
          'app.ts': {
            '@fixture/ds': 'package/config.js',
            'zyzz/runtime': null,
          },
        },
        modules: {
          'app.ts': source.replace(
            "'./platform/zyzz.config.js'",
            "'@fixture/ds'",
          ),
        },
        native,
      })
      const delivery = await Packed.bundle({
        entry: 'app.ts',
        modules: { 'app.ts': consumer.modules['app.ts']!.code },
        packages: {
          '@fixture/ds': {
            'index.ts': `export {style,variants,vars} from './platform/zyzz.config.js';`,
            ...Object.fromEntries(
              Object.entries(packed.modules).map(([name, value]) => [
                name,
                value.code,
              ]),
            ),
          },
        },
      })
      const installed = Vm.runInNewContext(`${delivery}\nFixture`) as typeof app
      expect(installed.result('inverse', 'dark')).toMatchInlineSnapshot(`
        {
          "label": {
            "color": "#000000ff",
            "fontFamily": "Pilat",
            "fontSize": 14,
            "fontWeight": 500,
            "letterSpacing": 0.14000000059604645,
            "lineHeight": 20,
          },
          "surface": {
            "backgroundColor": "#f5f5f5ff",
            "borderBottomLeftRadius": 999,
            "borderBottomRightRadius": 999,
            "borderTopLeftRadius": 999,
            "borderTopRightRadius": 999,
            "paddingBottom": 24,
            "paddingLeft": 24,
            "paddingRight": 24,
            "paddingTop": 24,
          },
        }
      `)
    },
  )

  test('executes static batches across independent theme contracts', async () => {
    const output = Graph.compile({
      modules: {
        'styles.ts':
          "import {Config,style} from 'zyzz';import {NativeContext} from 'zyzz/runtime';\n          const {style:a}=Config.create({vars:{base:{spacing:{cell:'2px'}},alternate:{spacing:{cell:'6px'}}},defaultVars:'base'});\n          const {style:b}=Config.create({vars:{base:{spacing:{cell:'4px'}},alternate:{spacing:{cell:'8px'}}},defaultVars:'base'});\n          const a1=a({width:'cell'});const a2=a({height:'cell'});\n          const b1=b({width:'cell'});const b2=b({height:'cell'});\n          const plain1=style({fontSize:'10px',lineHeight:1.5});\n          const plain2=style({opacity:0.2,targets:{ios:{opacity:0.7}}});\n          export const results=[a1,a2,b1,b2,plain1,plain2].map(value=>NativeContext.resolve(value().style,{set:'alternate',colorScheme:'dark'}));",
      },
      native: {
        colorScheme: 'light',
        contextual: true,
        platform: 'ios',
        units: { px: 1 },
      },
    })
    const module = await execute(output.modules['styles.ts']!.code)

    expect(module.results).toMatchInlineSnapshot(`
      [
        {
          "width": 6,
        },
        {
          "height": 6,
        },
        {
          "width": 8,
        },
        {
          "height": 8,
        },
        {
          "fontSize": 10,
          "lineHeight": 15,
        },
        {
          "opacity": 0.7,
        },
      ]
    `)
  })

  test('retains individual error paths when a static batch fails', () => {
    expect(() =>
      Native.compile({
        colorScheme: 'light',
        contextual: true,
        moduleId: 'styles.ts',
        source: `import {style} from 'zyzz';const first=style({opacity:0.2});const second=style({position:'fixed'});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [StyleSheet.CompileError: ["default","light","0","position"]: Unsupported native keyword.
      ["default","dark","0","position"]: Unsupported native keyword.]
    `)
  })

  test('resolves compiled inputs while retaining context errors and ordinary callbacks', async () => {
    const output = Graph.compile({
      modules: {
        'styles.ts':
          "import {Config} from 'zyzz'; import {NativeContext} from 'zyzz/runtime';\n          const {style}=Config.create({vars:{base:{color:{ink:'#112233'}},alternate:{color:{ink:'#0000ff'}}},defaultVars:'base'});\n          const meter=style((value:{width:string})=>({color:'ink',width:value.width}));\n          const context={colorScheme:'dark',set:'alternate'};\n          function message(context) { try { NativeContext.resolve(meter,context,{width:'12px'}); return 'no error' } catch(error) { return error.message } }\n          const callback=NativeContext.resolve((value)=>({opacity:value.opacity}),context);\n          export const results={direct:NativeContext.resolve(meter,context,{width:'12px'}),callback:callback({opacity:0.4}),missing:message(undefined),unknown:message({colorScheme:'dark',set:'missing'})};",
      },
      native: { colorScheme: 'light', contextual: true },
    })
    const module = await execute(output.modules['styles.ts']!.code)
    expect(module.results).toMatchInlineSnapshot(`
      {
        "callback": {
          "opacity": 0.4,
        },
        "direct": {
          "color": "#0000ff",
          "width": 12,
        },
        "missing": "Compiled native styles require a Zyzz Provider.",
        "unknown": "Unknown native set: missing.",
      }
    `)
  })

  test('reuses default native props while resolving independent themes and overrides', async () => {
    const source =
      "import {Config} from 'zyzz';\n      import {NativeContext} from 'zyzz/runtime';\n      const {style}=Config.create({vars:{base:{color:{ink:{light:'#112233',dark:'#ddeeff'}}},alternate:{color:{ink:{light:'#ff0000',dark:'#0000ff'}}}},defaultVars:'base'});\n      const ink=style({color:'ink'});\n      const defaults=ink();\n      const override={opacity:0.4};\n      const applied=ink({style:override});\n      const light={colorScheme:'light',set:'base'} as const;\n      const dark={colorScheme:'dark',set:'alternate'} as const;\n      const resolve=(value,context)=>NativeContext.resolve(value.style,context);\n      const first=resolve(defaults,light);\n      const second=resolve(defaults,dark);\n      const overridden=resolve(applied,dark);\n      override.opacity=0.8;\n      export const results={same:defaults===ink(),frozen:Object.isFrozen(defaults)&&Object.isFrozen(defaults.style),first,second,again:resolve(defaults,light),override:overridden[1]===override,opacity:overridden[1].opacity,callerFrozen:Object.isFrozen(override)};"
    const output = Graph.compile({
      modules: { 'styles.ts': source },
      native: { colorScheme: 'light', contextual: true },
    })

    expect((await execute(output.modules['styles.ts']!.code)).results).toEqual({
      same: true,
      frozen: true,
      first: { color: '#112233' },
      second: { color: '#0000ff' },
      again: { color: '#112233' },
      override: true,
      opacity: 0.8,
      callerFrozen: false,
    })
  })

  test('shares identical scheme tables while retaining contextual selection', async () => {
    const output = Native.compile({
      moduleId: 'shared.ts',
      colorScheme: 'light',
      contextual: true,
      source: `import {style} from 'zyzz';
        import {NativeContext} from 'zyzz/runtime';
        const card=style({opacity:0.5});
        const props=card();
        const light=NativeContext.resolve(props.style,{colorScheme:'light'});
        const dark=NativeContext.resolve(props.style,{colorScheme:'dark'});
        let missing='';try{NativeContext.resolve(props.style,undefined)}catch(error){missing=error.message}
        export const results={light,dark,same:light===dark,frozen:Object.isFrozen(light),missing};`,
    })

    expect((await execute(output.code)).results).toEqual({
      light: { opacity: 0.5 },
      dark: { opacity: 0.5 },
      same: true,
      frozen: true,
      missing: 'Compiled native styles require a Zyzz Provider.',
    })
  })

  test('reuses static defaults without bypassing input validation', async () => {
    const output = Native.compile({
      moduleId: 'static.ts',
      colorScheme: 'light',
      source: `import {style} from 'zyzz';
        const card=style({opacity:0.5});
        const first=card();
        const override={opacity:0.8};
        let error='';try{card({unknown:true})}catch(value){error=value.message}
        export const results={same:first===card(),frozen:Object.isFrozen(first),empty:card({}),override:card({style:override}).style[1]===override,error};`,
    })

    expect((await execute(output.code)).results).toEqual({
      same: true,
      frozen: true,
      empty: { style: { opacity: 0.5 } },
      override: true,
      error: 'Unknown native recipe input: unknown.',
    })
  })

  test('executes dynamic scalars and selected variant payloads in authored order', async () => {
    const source = `import {style,variants} from 'zyzz';
      const bar=style((values:{width:string;alpha:number})=>({width:values.width,opacity:values.alpha,fontSize:'10px',lineHeight:1.5}));
      const card=variants({base:{padding:'2px',opacity:0.1},variants:{size:{custom:(values:{gap:string;alpha:number})=>({padding:values.gap,opacity:values.alpha}),small:{padding:'4px'}}},defaultVariants:{size:{custom:{gap:'3px',alpha:0.5}}},compoundVariants:[{when:{size:'custom'},style:{paddingLeft:'9px'}}]});
      export const results=[bar({width:'12px',alpha:0.8}),bar({width:'20px',alpha:0.2}),card(),card({size:{custom:{gap:'6px',alpha:0.7}}}),card({size:null})];`
    const output = Native.compile({
      moduleId: 'dynamic.ts',
      source,
      colorScheme: 'light',
      units: { px: 2 },
    })
    expect((await execute(output.code)).results).toMatchInlineSnapshot(`
      [
        {
          "style": {
            "fontSize": 20,
            "lineHeight": 30,
            "opacity": 0.8,
            "width": 24,
          },
        },
        {
          "style": {
            "fontSize": 20,
            "lineHeight": 30,
            "opacity": 0.2,
            "width": 40,
          },
        },
        {
          "style": {
            "opacity": 0.5,
            "paddingBottom": 6,
            "paddingLeft": 18,
            "paddingRight": 6,
            "paddingTop": 6,
          },
        },
        {
          "style": {
            "opacity": 0.7,
            "paddingBottom": 12,
            "paddingLeft": 18,
            "paddingRight": 12,
            "paddingTop": 12,
          },
        },
        {
          "style": {
            "opacity": 0.1,
            "paddingBottom": 4,
            "paddingLeft": 4,
            "paddingRight": 4,
            "paddingTop": 4,
          },
        },
      ]
    `)
  })

  test('executes custom dynamic scalars without empty expression segments', async () => {
    const output = Native.compile({
      moduleId: 'custom.ts',
      colorScheme: 'light',
      source:
        "import {Config} from 'zyzz'; const {style}=Config.create({vars:{spacing:{md:'8px'}}}); const bar=style((values:{width:string})=>({width:`${values.width} !custom`})); export const results=bar({width:'12px'});",
      units: { px: 2 },
    })
    expect((await execute(output.code)).results).toEqual({
      style: { width: 24 },
    })
  })

  test('executes imported and packed dynamic contracts without publisher source', async () => {
    const directory = await Fs.mkdtemp(Path.resolve('.fixture-native-payload-'))
    try {
      const source = `import {style,variants} from 'zyzz';export const bar=style((values:{alpha:number})=>({opacity:values.alpha}));export const card=variants({variants:{size:{custom:(values:{gap:string})=>({padding:values.gap})}},defaultVariants:{size:{custom:{gap:'3px'}}}});`
      const publisher = Graph.compile({ modules: { 'library.ts': source } })
      const invalid = JSON.parse(publisher.contracts['library.ts']!)
      invalid.version = 22
      expect(() =>
        Graph.compile({
          contracts: { 'invalid.js': JSON.stringify(invalid) },
          modules: {},
        }),
      ).toThrow('Dynamic native contracts require version 23')
      invalid.version = 23
      invalid.exports.bar.style.dynamic.slots.alpha.name = '--z-unknown'
      expect(() =>
        Graph.compile({
          contracts: { 'invalid.js': JSON.stringify(invalid) },
          modules: {},
        }),
      ).toThrow('Invalid packed dynamic slot')
      const file = Path.join(directory, 'library.js')
      const imported = Graph.compile({
        imports: {
          'app.ts': { [file]: 'library.ts' },
          'library.ts': { zyzz: null },
        },
        modules: {
          'library.ts': source,
          'app.ts': `import {bar,card} from ${JSON.stringify(file)};export const results=[bar({alpha:0.6}),card({size:{custom:{gap:'5px'}}})];`,
        },
        native: { colorScheme: 'light' },
      })
      await Fs.writeFile(
        file,
        (
          await Esbuild.transform(imported.modules['library.ts']!.code, {
            loader: 'ts',
            format: 'esm',
          })
        ).code,
      )
      expect((await execute(imported.modules['app.ts']!.code)).results).toEqual(
        [
          { style: { opacity: 0.6 } },
          {
            style: {
              paddingTop: 5,
              paddingRight: 5,
              paddingBottom: 5,
              paddingLeft: 5,
            },
          },
        ],
      )
      await Fs.writeFile(
        file,
        (
          await Esbuild.transform(publisher.modules['library.ts']!.code, {
            loader: 'ts',
            format: 'esm',
          })
        ).code,
      )
      const consumer = `import {bar,card} from ${JSON.stringify(file)};export const results=[bar({alpha:0.4}),card({size:{custom:{gap:'8px'}}}),card()];`
      const compiled = Graph.compile({
        contracts: { [file]: publisher.contracts['library.ts']! },
        imports: { 'app.ts': { [file]: file } },
        modules: { 'app.ts': consumer },
        native: { colorScheme: 'light' },
      })
      expect(
        JSON.parse(publisher.contracts['library.ts']!).version,
      ).toMatchInlineSnapshot(`31`)
      expect((await execute(compiled.modules['app.ts']!.code)).results)
        .toMatchInlineSnapshot(`
        [
          {
            "style": {
              "opacity": 0.4,
            },
          },
          {
            "style": {
              "paddingBottom": 8,
              "paddingLeft": 8,
              "paddingRight": 8,
              "paddingTop": 8,
            },
          },
          {
            "style": {
              "paddingBottom": 3,
              "paddingLeft": 3,
              "paddingRight": 3,
              "paddingTop": 3,
            },
          },
        ]
      `)
    } finally {
      await Fs.rm(directory, { recursive: true, force: true })
    }
  })

  test('rejects invalid dynamic inputs and preserves caller overrides', async () => {
    const source = `import {style,variants} from 'zyzz';
      const bar=style((values:{width:string;alpha:number})=>({width:values.width,opacity:values.alpha,targets:{native:{transform:[{scale:2}]}}}));
      const card=variants({variants:{size:{custom:(values:{gap:string})=>({padding:values.gap})}}});
      const errors=[];
      for(const input of [{width:'4px'},{width:'4px',alpha:2},{width:'4px',alpha:0.5,unknown:1},{width:'calc(1px + 2%)',alpha:0.5}]){try{bar(input)}catch(error){errors.push(error.message)}}
      try{card({size:'custom'})}catch(error){errors.push(error.message)}
      const override={opacity:0.9};const output=bar({width:'8px',alpha:0.5,style:override});
      export const results={errors,identity:output.style[1]===override,callerFrozen:Object.isFrozen(override),staticFrozen:Object.isFrozen(output.style[0].transform)};`
    const output = Native.compile({
      source,
      moduleId: 'errors.ts',
      colorScheme: 'light',
    })
    expect((await execute(output.code)).results).toMatchInlineSnapshot(`
      {
        "callerFrozen": false,
        "errors": [
          "Missing or invalid native payload: alpha.",
          "Unsupported native numeric value.",
          "Unknown native recipe input: unknown.",
          "Unsupported native calc expression.",
          "Native payloads require scalar fields.",
        ],
        "identity": true,
        "staticFrozen": true,
      }
    `)
  })

  test('retains opaque values through dynamic calls, replacement and composition', async () => {
    const source = `import {style,variants,cx} from 'zyzz';
      const base=style({opacity:0.2});
      const bar=style((input:{alpha:number})=>({opacity:input.alpha}));
      const card=variants({variants:{size:{custom:(input:{gap:string})=>({padding:input.gap})}}});
      const first={}; const second={};
      Object.defineProperty(first,'inspect',{get(){throw new Error('Opaque values must not be traversed')}});
      const override={opacity:first,color:second,transform:[{translateX:first}]};
      const nested=[false,[override,null]];
      const applied=bar({alpha:0.3,style:nested});
      const replaced=bar({alpha:0.7,style:{opacity:second}});
      const selected=card({size:{custom:{gap:'8px'}},style:nested});
      const combined=cx(base(),applied,false,selected,replaced);
      first.current=0.9;
      export const results={nested:applied.style[1]===nested,selected:selected.style[1]===nested,first:applied.style[1][1][0].opacity===first,second:replaced.style[1].opacity===second,composed:combined.style[1]===applied.style&&combined.style[2]===selected.style&&combined.style[3]===replaced.style,updated:combined.style[1][1][1][0].opacity.current,frozen:[Object.isFrozen(first),Object.isFrozen(second),Object.isFrozen(override),Object.isFrozen(nested)]};`
    const compiled = Native.compile({
      source,
      moduleId: 'opaque.ts',
      colorScheme: 'light',
    })
    expect((await execute(compiled.code)).results).toEqual({
      nested: true,
      selected: true,
      first: true,
      second: true,
      composed: true,
      updated: 0.9,
      frozen: [false, false, false, false],
    })
  })

  test('invalidates a reused native context after scheme changes', () => {
    const compiler = Graph.create()
    const modules = {
      'card.ts':
        "import {Config} from 'zyzz';const {style}=Config.create({vars:{color:{ink:{light:'#000000',dark:'#ffffff'}}}});export const card=style({color:'ink'});",
    }
    const native: NonNullable<Graph.compile.Options['native']> & {
      colorScheme: 'dark' | 'light'
    } = { colorScheme: 'light' }
    const light = compiler.compile({ modules, native })
    native.colorScheme = 'dark'
    const dark = compiler.compile({ modules, native })
    expect(
      light.modules['card.ts']!.code.includes('#000000'),
    ).toMatchInlineSnapshot('true')
    expect(
      dark.modules['card.ts']!.code.includes('#ffffff'),
    ).toMatchInlineSnapshot('true')
    expect(
      compiler.compile({ modules, native }) === dark,
    ).toMatchInlineSnapshot('true')
  })

  test('preserves explicit exports over packed star exports', () => {
    const library = Graph.compile({
      modules: {
        'library.ts': `import {style} from 'zyzz';export const card=style({opacity:0.5});`,
      },
    })
    for (const source of [
      `export const card=()=>({style:{opacity:0.2}});export * from 'library';`,
      `export const {card}={card:()=>({style:{opacity:0.2}})};export * from 'library';`,
      `export * from 'library';export * from 'library';`,
    ]) {
      const output = Graph.compile({
        contracts: { 'library.js': library.contracts['library.ts']! },
        imports: { 'app.ts': { library: 'library.js' } },
        modules: { 'app.ts': source },
        native: { colorScheme: 'light' },
      })
      expect(
        Parser.parseSync('app.ts', output.modules['app.ts']!.code).errors,
      ).toMatchInlineSnapshot('[]')
      if (source.startsWith('export const'))
        expect(
          output.modules['app.ts']!.code.includes('as "card"'),
        ).toMatchInlineSnapshot('false')
      else
        expect(
          output.modules['app.ts']!.code.match(/as "card"/g)?.length,
        ).toMatchInlineSnapshot('1')
    }
  })

  test('executes native callables with defaults, nulls and ordered composition', async () => {
    const result = Native.compile({
      moduleId: 'card.ts',
      source,
      platform: 'ios',
      colorScheme: 'light',
    })
    const module = await execute(result.code)
    expect(StyleSheet.flatten(module.card().style)).toMatchInlineSnapshot(`
      {
        "fontSize": 12,
        "lineHeight": 18,
        "opacity": 0.8,
      }
    `)
    expect(StyleSheet.flatten(module.card({ size: null, active: null }).style))
      .toMatchInlineSnapshot(`
      {
        "fontSize": 10,
        "lineHeight": 15,
        "opacity": 0.2,
      }
    `)
    expect(StyleSheet.flatten(module.compose(false).style))
      .toMatchInlineSnapshot(`
      {
        "fontSize": 20,
        "lineHeight": 30,
        "opacity": 0.7,
        "transform": [
          {
            "scale": 2,
          },
        ],
      }
    `)
    expect(
      StyleSheet.flatten(module.compose(true).style)?.opacity,
    ).toMatchInlineSnapshot('0.9')
    expect(
      module.card().style === module.card({ size: undefined }).style,
    ).toMatchInlineSnapshot('true')
    expect(Object.isFrozen(module.card().style)).toMatchInlineSnapshot('true')
    expect(() =>
      Runtime.compose({ style: undefined, className: 'web' } as Runtime.Props),
    ).toThrowErrorMatchingInlineSnapshot(
      '[Native.SelectionError: Native composition requires native style props.]',
    )
    expect(module.shadow((value) => value + 1)).toMatchInlineSnapshot('3')
    const override = { transform: [{ rotate: '45deg' as const }] }
    const props = module.card({ style: [false, [override]] })
    expect(
      StyleSheet.flatten(props.style)?.transform === override.transform,
    ).toMatchInlineSnapshot('true')
    expect(Object.isFrozen(override.transform)).toMatchInlineSnapshot('false')
    expect(() =>
      module.card({ size: 'unknown' as 'small' }),
    ).toThrowErrorMatchingInlineSnapshot(
      '[Native.SelectionError: Unknown native recipe choice for size.]',
    )
    expect(
      Transform.compile({
        moduleId: 'card.ts',
        source: source.slice(0, source.indexOf('const overlay')),
      }).css.includes('data-size'),
    ).toMatchInlineSnapshot('true')
  })

  test.each([
    `export const compose=()=>props;const props=cx({style:{opacity:0.5}});import {cx} from 'zyzz';`,
    `"use client";const card=style({opacity:0.5});const props=mix(card());export const compose=()=>props;import {cx as mix,style} from 'zyzz';`,
  ])('preserves composition before its import: %s', async (source) => {
    const output = Native.compile({
      source,
      moduleId: 'hoisted.ts',
      colorScheme: 'light',
    })
    const module = await execute(output.code)

    expect(StyleSheet.flatten(module.compose(false).style))
      .toMatchInlineSnapshot(`
      {
        "opacity": 0.5,
      }
    `)
  })

  test.each([
    ['#!/usr/bin/env node\n', []],
    ['"use client"\n', ['use client']],
    [
      '#!/usr/bin/env node\n"use client";\n"use strict"\n',
      ['use client', 'use strict'],
    ],
  ] as const)(
    'preserves module prologues: %s',
    async (prologue, directives) => {
      const output = Native.compile({
        source: `${prologue}${source}`,
        moduleId: 'prologue.ts',
        platform: 'ios',
        colorScheme: 'light',
      })
      const parsed = Parser.parseSync('prologue.ts', output.code)

      expect(parsed.errors).toMatchInlineSnapshot('[]')
      expect(output.code.startsWith(prologue.trimEnd())).toMatchInlineSnapshot(
        'true',
      )
      expect(
        JSON.stringify(
          parsed.program.body
            .filter(
              (node) => node.type === 'ExpressionStatement' && node.directive,
            )
            .map(
              (node) => node.type === 'ExpressionStatement' && node.directive,
            ),
        ) === JSON.stringify(directives),
      ).toMatchInlineSnapshot('true')
      const module = await execute(output.code)
      expect(
        StyleSheet.flatten(module.compose(true).style)?.opacity,
      ).toMatchInlineSnapshot('0.9')
    },
  )

  test.each(['Z.cx', "Z['cx']"])('rejects namespace composition: %s', (cx) => {
    expect(() =>
      Native.compile({
        source: `import {style} from 'zyzz';import * as Z from 'zyzz';const card=style({opacity:0.5});export const composed=${cx}(card());`,
        moduleId: 'namespace.ts',
        colorScheme: 'light',
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: namespace.ts:107: Import cx by name; namespace authoring calls are not supported yet.]`,
    )
  })

  test('compiles local configured tokens for explicit schemes', async () => {
    const source =
      "import {Config} from 'zyzz';\nconst config=Config.create({vars:{color:{ink:{light:'#000',dark:'#fff'}}}});\nexport const card=config.variants({base:{color:'ink'},variants:{tone:{quiet:{opacity:0.5}}},defaultVariants:{tone:'quiet'}});"
    const light = await execute(
      Native.compile({ source, moduleId: 'theme.ts', colorScheme: 'light' })
        .code,
    )
    const dark = await execute(
      Native.compile({ source, moduleId: 'theme.ts', colorScheme: 'dark' })
        .code,
    )
    expect(StyleSheet.flatten(light.card().style)?.color).toMatchInlineSnapshot(
      '"#000"',
    )
    expect(StyleSheet.flatten(dark.card().style)?.color).toMatchInlineSnapshot(
      '"#fff"',
    )
  })

  test.each([false, true])(
    'type-checks emitted callables with contextual=%s through published runtime declarations',
    async (contextual) => {
      const directory = await Fs.mkdtemp(
        Path.resolve('.fixture-native-callable-'),
      )
      try {
        await Fs.writeFile(
          Path.join(directory, 'compiled.ts'),
          Native.compile({
            source:
              source +
              `export const bar=style((value:{alpha:number})=>({opacity:value.alpha}));export const custom=variants({variants:{size:{custom:(value:{gap:string})=>({padding:value.gap})}},defaultVariants:{size:{custom:{gap:'2px'}}}});`,
            moduleId: 'compiled.ts',
            platform: 'ios',
            colorScheme: 'light',
            contextual,
          }).code,
        )
        const consumer = Path.join(directory, 'consumer.ts')
        await Fs.writeFile(
          consumer,
          `import {bar,card,compose,custom} from './compiled.js';
const opaque={tag:Symbol('host')};
const native={opacity:opaque,color:opaque};
bar({alpha:0.5,style:native});
card({style:[false,[native]]});
custom({size:{custom:{gap:'8px'}},style:native});
bar({alpha:0.5});
custom();
custom({size:{custom:{gap:'8px'}}});
// @ts-expect-error Dynamic styles require their values.
bar();
// @ts-expect-error Dynamic field types survive compilation.
bar({alpha:'bad'});
// @ts-expect-error Dynamic choices require scoped payloads.
custom({size:'custom'});
// @ts-expect-error Payload field types survive compilation.
custom({size:{custom:{gap:8}}});
card({size:'small',active:true});
card({size:null,style:[false,{opacity:0.5}]});
compose(false);
// @ts-expect-error Unknown choices remain rejected after transformation.
card({size:'missing'});
// @ts-expect-error Native callables reject class props.
card({className:'web'});
// @ts-expect-error Boolean axes retain their boolean input.
card({active:'true'});
// @ts-expect-error Native output has no className.
card().className;
`,
        )
        await Util.promisify(ChildProcess.execFile)(
          process.execPath,
          [
            Path.resolve('node_modules/typescript/bin/tsc'),
            '--ignoreConfig',
            '--noEmit',
            '--module',
            'nodenext',
            '--target',
            'esnext',
            '--strict',
            '--skipLibCheck',
            consumer,
          ],
          { timeout: 30000 },
        )
      } finally {
        await Fs.rm(directory, { recursive: true, force: true })
      }
    },
    35000,
  )

  test.each([0, 65_536])(
    'retains source mappings and helper names with %i characters of Unicode comments',
    async (length) => {
      const input = `/*${'😀'.repeat(length / 2)}*/const __zyzzNative=1;\n${source}`
      const output = Native.compile({
        source: input,
        moduleId: 'collision.ts',
        colorScheme: 'dark',
        platform: 'android',
      })
      const module = await execute(output.code)
      expect(
        StyleSheet.flatten(module.compose(false).style)?.opacity,
      ).toMatchInlineSnapshot('0.5')
      const position = output.code.indexOf('export function shadow')
      const prefix = output.code.slice(0, position).split('\n')
      const original = Trace.originalPositionFor(
        new Trace.TraceMap(output.map),
        {
          line: prefix.length,
          column: prefix.at(-1)!.length,
        },
      )
      expect(original.source).toMatchInlineSnapshot('"collision.ts"')
      expect(original.line).toMatchInlineSnapshot('11')
    },
  )

  test.each([0, 65_536])(
    'compiles asserted imported literals with %i characters of Unicode comments',
    async (length) => {
      const output = Graph.compile({
        modules: {
          'values.ts': `/*${'😀'.repeat(length / 2)}*/export const values = <{opacity: 0.25}>{opacity: 0.25};`,
          'styles.ts': `/*${'😀'.repeat(length / 2)}*/import {style} from 'zyzz';
          import {values} from './values';
          const card=style(values);
          export const results={style:card().style,number:123n.toString(),matched:/😀/u.test('😀')};`,
        },
        native: { colorScheme: 'light' },
      })
      const code = output.modules['styles.ts']!.code.replace(
        "import {values} from './values';",
        '',
      )

      expect((await execute(code)).results).toMatchInlineSnapshot(`
      {
        "matched": true,
        "number": "123",
        "style": {
          "opacity": 0.25,
        },
      }
    `)
    },
  )

  test('rejects native conditions and HTML output', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'native.ts',
        source:
          "import {style} from 'zyzz';export const card=style({opacity:1});",
        target: 'native',
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      '[Error: Use Native.compile for native source output.]',
    )
    for (const definition of [
      `variants({conditions:{wide:'@media (width > 0px)'},variants:{tone:{quiet:{opacity:0.5}}}})`,
    ])
      expect(() =>
        Native.compile({
          moduleId: 'bad.ts',
          colorScheme: 'light',
          source: `import {variants} from 'zyzz';export const card=${definition};`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        '[Native.CompileError: Native source compilation does not support named conditions or HTML output.]',
      )
    expect(() =>
      Native.compile({
        moduleId: 'bad.ts',
        colorScheme: 'light',
        source: `import {style} from 'zyzz';export const card=style({':hover':{opacity:0.5}});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[StyleSheet.CompileError: ["style-ucw0031385wid-45"]: Selectors, queries, and nested rules are not supported on native.]`,
    )
  })
})
