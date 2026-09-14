/** Exercises variable assignments and selector groups from source to browser and packed consumers. @module */
import * as Esbuild from 'esbuild'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Transform } from 'zyzz/compiler'

const library = `import {css, variable} from 'zyzz'
export namespace variables {
  export const accent = variable('color')
  export const gap = variable('length', {inherits: true, initialValue: '4px'})
}
export namespace styles {
  export const card = css({variables: {[variables.accent]: 'tomato', [variables.gap]: '12px'}})
  export const label = css({
    color: variables.accent,
    padding: variables.gap,
    selectors: {
      '&:nth-child(even)': {opacity: 0.5},
      [\`\${card}[data-open] &\`]: {variables: {[variables.accent]: 'purple'}},
    },
  })
}`

describe('variable', () => {
  test('preserves grouped variables in dynamic definitions and packed exports', () => {
    const publisher = Graph.compile({
      modules: {
        'group.ts': `import {css,variable} from 'zyzz'; export const variables={gap:variable('length')}; export const box=css((input:{opacity:number})=>({padding:variables.gap,opacity:input.opacity}));`,
      },
    })
    const consumer = Graph.compile({
      contracts: publisher.contracts,
      imports: { 'app.ts': { './group.js': 'group.ts', zyzz: null } },
      modules: {
        'app.ts': `import {css} from 'zyzz'; import {variables} from './group.js';export const box=css((input:{opacity:number})=>({padding:variables.gap,opacity:input.opacity}));`,
      },
    })

    expect(publisher.modules['group.ts']!.css).toMatchInlineSnapshot(
      `
      ".z-p-RjUNTU{padding:var(--z-v1n60vkvri6abp-63);}
      .z-opacity-RjUNTU{opacity:var(--z-d1n60vkvri6abp-101-6f-70-61-63-69-74-79);}"
    `,
    )
    expect(consumer.modules['app.ts']!.css).toMatchInlineSnapshot(
      `
      ".z-p-Jgxd-Q{padding:var(--z-v1n60vkvri6abp-63);}
      .z-opacity-Jgxd-Q{opacity:var(--z-d1e8a67z1uaws1j-80-6f-70-61-63-69-74-79);}"
    `,
    )
  })

  test('rejects variable factories in conditional and wrapped initializers', () => {
    expect(() =>
      Graph.compile({
        modules: {
          'invalid.ts': `import {variable} from 'zyzz';export const accent=enabled?variable('color'):variable('color')`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:58: variable requires a direct constant or object-group initializer.]`,
    )
    expect(() =>
      Graph.compile({
        modules: {
          'invalid.ts': `import {variable} from 'zyzz';export const accent=wrap(variable('color'))`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:55: variable requires a direct constant or object-group initializer.]`,
    )
  })

  test('rejects negative unsigned registration defaults and accepts signed defaults', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.js',
        source: `import {variable} from 'zyzz'; const gap=variable('length',{inherits:false,initialValue:'-1px'})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.js:59: Unsigned variable registrations require a nonnegative literal initialValue.]`,
    )
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.js',
        source: `import {variable} from 'zyzz'; const amount=variable('percentage',{inherits:false,initialValue:'-1%'})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.js:66: Unsigned variable registrations require a nonnegative literal initialValue.]`,
    )
    const result = Transform.compile({
      moduleId: 'signed.js',
      source: `import {variable} from 'zyzz'; export const gap=variable('signedLength',{inherits:false,initialValue:'-1px'});export const amount=variable('signedPercentage',{inherits:false,initialValue:'-1%'})`,
    })

    expect(result.css).toMatchInlineSnapshot(`
      "@property --z-v132xrt2pjcnoa-48{syntax:"<length>";inherits:false;initial-value:-1px;}
      @property --z-v132xrt2pjcnoa-130{syntax:"<percentage>";inherits:false;initial-value:-1%;}"
    `)
  })

  test.each([
    ['length', 'calc(-1px)'],
    ['percentage', 'calc(-1%)'],
    ['length', 'min(1px, -1px)'],
    ['percentage', 'min(1%, -1%)'],
    ['length', 'calc(1px)'],
    ['percentage', 'calc(1%)'],
  ])('rejects computed %s registration defaults: %s', (kind, initialValue) => {
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.js',
        source: `import {variable} from 'zyzz'; export const value=variable('${kind}',{inherits:false,initialValue:'${initialValue}'})`,
      }),
    ).toThrow(
      'Unsigned variable registrations require a nonnegative literal initialValue.',
    )
  })

  test.each([
    ['length', '0'],
    ['length', '1px'],
    ['length', '.5cm'],
    ['length', '+1e-2in'],
    ['percentage', '0%'],
    ['percentage', '.5%'],
    ['percentage', '+1e-2%'],
  ])(
    'accepts nonnegative literal %s registration defaults: %s',
    (kind, initialValue) => {
      const result = Transform.compile({
        moduleId: 'valid.js',
        source: `import {variable} from 'zyzz'; export const value=variable('${kind}',{inherits:false,initialValue:'${initialValue}'})`,
      })

      expect(result.css).toContain(`initial-value:${initialValue};`)
    },
  )

  test('preserves untyped variables through packed imports and browser assignments', async () => {
    const publisher = Graph.compile({
      modules: {
        'values.ts': `import {variable} from 'zyzz'; export const value = variable()`,
      },
    })
    const consumer = Graph.compile({
      contracts: publisher.contracts,
      imports: { 'app.ts': { './values.js': 'values.ts', zyzz: null } },
      modules: {
        'app.ts': `import {css} from 'zyzz'; import {value} from './values.js'; export const style=css({variables:{[value]:'inline-flex'},display:value,selectors:{'&:hover':{display:value}}}); export {value}`,
      },
    })

    expect(consumer.modules['app.ts']!.css).toMatchInlineSnapshot(
      `
      ".z---z-v1ndkzo68ghlgm-52-inline-flex-FMCy0p-0{--z-v1ndkzo68ghlgm-52:inline-flex;}
      .z-display-FMCy0p-1{display:var(--z-v1ndkzo68ghlgm-52);}
      .z-hover-display-FMCy0p-2{&:hover{display:var(--z-v1ndkzo68ghlgm-52);}}"
    `,
    )

    const source =
      publisher.modules['values.ts']!.code +
      '\n' +
      consumer.modules['app.ts']!.code.replace(
        "import {value} from './values.js';",
        '',
      ).replace('export {value}', '')
    const built = await Esbuild.build({
      stdin: { contents: source, loader: 'ts', resolveDir: process.cwd() },
      alias: { 'zyzz/runtime': Path.resolve('src/runtime/index.ts') },
      bundle: true,
      format: 'iife',
      globalName: 'Fixture',
      write: false,
    })
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox'],
    })
    try {
      const page = await browser.newPage()
      await page.setContent('<div>variable</div>')
      await page.addStyleTag({ content: consumer.modules['app.ts']!.css })
      await page.addScriptTag({ content: built.outputFiles[0]!.text })
      await page.evaluate(
        `document.querySelector('div').className=Fixture.style().className`,
      )

      expect(
        await page
          .locator('div')
          .evaluate((node) => getComputedStyle(node).display),
      ).toMatchInlineSnapshot(`"inline-flex"`)

      await page.evaluate(`{
        for (const [key,value] of Object.entries(Fixture.style({variables:{[Fixture.value]:'grid'}}).style))
          document.querySelector('div').style.setProperty(key,value);
      }`)

      expect(
        await page
          .locator('div')
          .evaluate((node) => getComputedStyle(node).display),
      ).toMatchInlineSnapshot(`"grid"`)
    } finally {
      await browser.close()
    }
  })

  test('preserves namespaces, re-exports, registration and assignment order in packed consumers', () => {
    const publisher = Graph.compile({
      modules: {
        'lib/library.ts': library,
        'lib/barrel.ts': `export {variables, styles} from './library.js'`,
      },
    })
    const consumer = Graph.compile({
      contracts: publisher.contracts,
      imports: { 'app.ts': { './barrel.js': 'lib/barrel.ts', zyzz: null } },
      modules: {
        'app.ts': `import {css} from 'zyzz'; import {variables, styles} from './barrel.js'; const accent=variables.accent; export const label=css({variables:{[accent]:'blue'},color:accent,selectors:{[\`\${styles.card}:hover &\`]:{variables:{[accent]:'green'}}}}); export const inline=accent.set('red')`,
      },
    })

    expect(
      JSON.parse(publisher.contracts['lib/library.ts']!).version,
    ).toMatchInlineSnapshot(`17`)
    expect(consumer.modules['app.ts']!.css).toMatchInlineSnapshot(
      `
      ".z---z-v1ym5zhz14a14rh-88-blue-EIPVmp-0{--z-v1ym5zhz14a14rh-88:blue;}
      .z-text-EIPVmp-1{color:var(--z-v1ym5zhz14a14rh-88);}
      .z---z-v1ym5zhz14a14rh-88-EIPVmp-2{.z-style-1ym5zhz14a14rh-235:hover &{--z-v1ym5zhz14a14rh-88:green;}}"
    `,
    )
    expect(consumer.modules['app.ts']!.code).toMatchInlineSnapshot(`
      "
      import { Props as __zyzzProps } from 'zyzz/runtime';
       import {variables, styles} from './barrel.js'; const accent=variables.accent; export const label=__zyzzProps.create({className:"z---z-v1ym5zhz14a14rh-88-blue-EIPVmp-0 z-text-EIPVmp-1 z---z-v1ym5zhz14a14rh-88-EIPVmp-2 z-style-1e8a67z1uaws1j-123"}); export const inline=accent.set('red')"
    `)
  })

  test('rejects invalid group structures and forward variables without executing source', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import {css,variable} from 'zyzz'; css({color:accent});const accent=variable('color')`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:46: Variables must be declared before use.]`,
    )
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import {css,variable} from 'zyzz'; css({color:variables.accent});namespace variables {export const accent=variable('color')}`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:46: Variables must be declared before use.]`,
    )
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import {css} from 'zyzz';css({selectors:{'body':{color:'red'}}})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:41: Selectors require an explicit & target.]`,
    )
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import {css} from 'zyzz';css({variables:{accent:'red'}})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:41: Variable assignments require declared variable keys.]`,
    )
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import {css,variable} from 'zyzz'; const accent=variable('color'); css({variables:{[accent]:{color:'red'}}})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:92: Expected a literal string or number; expressions are not evaluated.]`,
    )
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import {variable} from 'zyzz'; function local(){return variable('color')}`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:55: variable requires a module-level constant.]`,
    )
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import {variable} from 'zyzz'; const fake=()=>variable('color')`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:46: variable requires a module-level constant.]`,
    )
  })

  test('renders inherited defaults, conditional assignments and inline updates with fixed rules', async () => {
    const result = Graph.compile({ modules: { 'library.ts': library } })
    const built = await Esbuild.build({
      stdin: {
        contents: result.modules['library.ts']!.code,
        loader: 'ts',
        resolveDir: process.cwd(),
      },
      alias: { 'zyzz/runtime': Path.resolve('src/runtime/index.ts') },
      bundle: true,
      format: 'iife',
      globalName: 'Fixture',
      write: false,
    })
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox'],
    })
    try {
      const page = await browser.newPage()
      await page.setContent(
        '<main><span>first</span><span>second</span></main>',
      )
      await page.addStyleTag({ content: result.modules['library.ts']!.css })
      await page.addScriptTag({ content: built.outputFiles[0]!.text })
      await page.evaluate(`{
        const card=document.querySelector('main');card.className=Fixture.styles.card().className;
        for(const span of document.querySelectorAll('span'))span.className=Fixture.styles.label().className;
      }`)
      const read = () =>
        page.locator('span').evaluateAll((nodes) =>
          nodes.map((node) => {
            const style = getComputedStyle(node)
            return [style.color, style.padding, style.opacity]
          }),
        )
      expect(await read()).toMatchInlineSnapshot(`
        [
          [
            "rgb(255, 99, 71)",
            "12px",
            "1",
          ],
          [
            "rgb(255, 99, 71)",
            "12px",
            "0.5",
          ],
        ]
      `)
      await page
        .locator('main')
        .evaluate((node) => node.setAttribute('data-open', ''))
      expect(await read()).toMatchInlineSnapshot(`
        [
          [
            "rgb(128, 0, 128)",
            "12px",
            "1",
          ],
          [
            "rgb(128, 0, 128)",
            "12px",
            "0.5",
          ],
        ]
      `)
      const count = await page.evaluate(() =>
        [...document.styleSheets].reduce(
          (sum, sheet) => sum + sheet.cssRules.length,
          0,
        ),
      )
      await page.evaluate(`{
        const [first]=document.querySelectorAll('span');
        const props=Fixture.styles.label({variables:{[Fixture.variables.accent]:'blue'}});
        for(const [key,value]of Object.entries(props.style))first.style.setProperty(key,value);
      }`)
      expect(await read()).toMatchInlineSnapshot(`
        [
          [
            "rgb(0, 0, 255)",
            "12px",
            "1",
          ],
          [
            "rgb(128, 0, 128)",
            "12px",
            "0.5",
          ],
        ]
      `)
      expect(
        (await page.evaluate(() =>
          [...document.styleSheets].reduce(
            (sum, sheet) => sum + sheet.cssRules.length,
            0,
          ),
        )) === count,
      ).toMatchInlineSnapshot(`true`)
    } finally {
      await browser.close()
    }
  })
})
